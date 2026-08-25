import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { StatusPill } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { saveTicket } from "@/lib/vaani/account";
import { parseVoiceOrder } from "@/lib/vaani/ai";
import { fallbackParse } from "@/lib/vaani/match";
import { INDUSTRY_LABEL, LANGUAGES, formatInPhone, samplesFor } from "@/lib/vaani/seed";
import { findOpenTicket, readLoginTen, useVaani, vendorById } from "@/lib/vaani/store";
import type { LineItem, Ticket } from "@/lib/vaani/types";

export const Route = createFileRoute("/call/$vendorId")({ component: CallScreen });

const READY_SECS = 3;

function CallScreen() {
  const { vendorId } = Route.useParams();
  const liveVendors = useVaani((s) => s.liveVendors);
  const found = vendorById(vendorId) ?? liveVendors.find((v) => v.id === vendorId);
  const navigate = useNavigate();
  const customerName = useVaani((s) => s.customerName);
  const customerPhone = useVaani((s) => s.customerPhone);
  const language = useVaani((s) => s.language);
  const upsertTicket = useVaani((s) => s.upsertTicket);

  const [phase, setPhase] = useState<"idle" | "countdown" | "recording" | "parsing" | "review">("idle");
  const [count, setCount] = useState(0);
  const [live, setLive] = useState("");
  const [transcript, setTranscript] = useState("");
  const [lines, setLines] = useState<LineItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const speechRef = useRef<{ stop: () => void } | null>(null);
  const liveRef = useRef("");
  const transcriptRef = useRef("");
  const listRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef(0);
  const vendorRef = useRef(found);
  vendorRef.current = found;

  async function startRec() {
    const vendor = vendorRef.current;
    if (!vendor) return;
    const id = ++sessionRef.current;
    setError(null);
    setWarning(null);
    setLive("");
    liveRef.current = "";
    chunksRef.current = [];
    setPhase("countdown");
    setCount(READY_SECS);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (sessionRef.current !== id) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      for (let n = READY_SECS; n >= 1; n -= 1) {
        if (sessionRef.current !== id) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        setCount(n);
        await wait(1000);
      }
      if (sessionRef.current !== id) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : MediaRecorder.isTypeSupported("audio/mp4")
            ? "audio/mp4"
            : "";
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      rec.start(250);
      setPhase("recording");
      setCount(0);
      const w = window as unknown as {
        SpeechRecognition?: new () => BrowserSpeech;
        webkitSpeechRecognition?: new () => BrowserSpeech;
      };
      const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
      if (Ctor) {
        const recg = new Ctor();
        recg.lang = language || "en-IN";
        recg.continuous = true;
        recg.interimResults = true;
        recg.onresult = (ev) => {
          let t = "";
          for (let i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript + " ";
          liveRef.current = t.trim();
          setLive(t.trim());
        };
        recg.start();
        speechRef.current = recg;
      }
    } catch {
      setError("Microphone blocked. Type the order below instead.");
      setPhase("idle");
    }
  }

  async function stopAndParse(typed?: string) {
    const vendor = vendorRef.current;
    if (!vendor) return;
    sessionRef.current += 1;
    setPhase("parsing");
    setError(null);
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") {
      await new Promise<void>((resolve) => {
        rec.onstop = () => resolve();
        rec.stop();
      });
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    try {
      speechRef.current?.stop();
    } catch {
      /* ignore */
    }

    let audioBase64: string | undefined;
    let mimeType: string | undefined;
    if (chunksRef.current.length) {
      const blob = new Blob(chunksRef.current, { type: rec?.mimeType || "audio/webm" });
      mimeType = blob.type;
      audioBase64 = await blobToB64(blob);
    }

    const spoken = (typed ?? liveRef.current ?? transcriptRef.current).trim();
    const localLines = spoken ? fallbackParse(spoken) : [];
    if (localLines.length) {
      setTranscript(spoken);
      transcriptRef.current = spoken;
      setLines(localLines);
      setPhase("review");
      queueMicrotask(() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
    try {
      const result = await parseVoiceOrder({
        data: {
          transcript: spoken || undefined,
          audioBase64: spoken ? undefined : audioBase64,
          mimeType: spoken ? undefined : mimeType,
          industry: vendor.industry,
          language: language || "en-IN",
        },
      });
      if (!result.ok) {
        if (localLines.length) {
          setWarning(result.error);
          return;
        }
        setError(result.error);
        setPhase("idle");
        return;
      }
      const text = spoken || result.transcript;
      setTranscript(text);
      transcriptRef.current = text;
      setLines(fallbackParse(text));
      setWarning("warning" in result ? (result.warning ?? null) : null);
      setPhase("review");
      queueMicrotask(() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (err) {
      if (localLines.length) {
        setWarning(err instanceof Error ? err.message : "Showing spoken list.");
        return;
      }
      setError(err instanceof Error ? err.message : "Could not read the list.");
      setPhase("idle");
    }
  }

  useEffect(() => {
    if (phase !== "recording") return;
    setCount(0);
    const tick = window.setInterval(() => {
      setCount((n) => n + 1);
    }, 1000);
    return () => window.clearInterval(tick);
  }, [phase]);

  async function send() {
    const vendor = vendorRef.current;
    if (!vendor) return;
    const orderPhone = formatInPhone(customerPhone || readLoginTen());
    const open = findOpenTicket(vendor.id);
    if (open) {
      const next: Ticket = {
        ...open,
        transcript: [open.transcript, transcript].filter(Boolean).join("\n"),
        lines: [...open.lines, ...lines],
        status: open.lines.some((l) => l.status !== "pending") ? "reviewing" : "sent",
        orderCopy: null,
        updatedAt: new Date().toISOString(),
      };
      upsertTicket(next);
      try {
        await saveTicket({ data: { ticket: next } });
      } catch {
        /* local copy still held */
      }
      void navigate({ to: "/ticket/$ticketId", params: { ticketId: next.id } });
      return;
    }
    const ticket: Ticket = {
      id: crypto.randomUUID(),
      vendorId: vendor.id,
      customerName: customerName || "Shop",
      customerPhone: orderPhone,
      language: language || "en-IN",
      transcript,
      createdAt: new Date().toISOString(),
      status: "sent",
      lines,
      orderCopy: null,
      notes: "",
      updatedAt: new Date().toISOString(),
    };
    upsertTicket(ticket);
    try {
      await saveTicket({ data: { ticket } });
    } catch {
      /* local copy still held */
    }
    void navigate({ to: "/ticket/$ticketId", params: { ticketId: ticket.id } });
  }

  if (!found) {
    return (
      <>
        <p>Vendor not found.</p>
      </>
    );
  }
  const vendor = found;
  const listLang = LANGUAGES.find((l) => l.id === (language || "en-IN"));
  const dialMode =
    phase === "countdown" ? "ready" : phase === "recording" ? "listen" : phase === "parsing" ? "wait" : "idle";

  return (
    <>
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">Calling</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight">{vendor.shop}</h1>
      <p className="text-sm text-muted">
        {vendor.name} · {vendor.phone} · {INDUSTRY_LABEL[vendor.industry]}
      </p>

      <div className="mx-auto mt-6 max-w-md rounded-[var(--radius-lg)] border border-line bg-surface p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          Example — {INDUSTRY_LABEL[vendor.industry]}
        </p>
        <p className="mt-1 text-xs text-muted">
          Product + quantity to order. Product + cost/rate to ask a price.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {samplesFor(vendor.industry).map((s) => (
            <button
              key={s}
              type="button"
              className="rounded-full border border-line bg-bg px-3 py-1 text-left text-xs text-muted"
              onClick={() => {
                const next = transcript ? `${transcript}\n${s}` : s;
                transcriptRef.current = next;
                setTranscript(next);
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-4 max-w-md rounded-[var(--radius-xl)] border border-line bg-surface p-6 text-center">
        <ListenDial mode={dialMode} count={count} />
        <p className="mt-4 font-display text-xl">
          {phase === "idle" && "Connected — hold the line"}
          {phase === "countdown" && "Wait — starting in"}
          {phase === "recording" && "Listening — speak now"}
          {phase === "parsing" && "Wait — Vaani is reading"}
          {phase === "review" && "Your list"}
        </p>
        <p className="mt-2 text-sm text-muted">
          {phase === "countdown" && "Get ready. Speak after the count."}
          {phase === "recording" && "Speak the list. Tap stop when done."}
          {phase === "parsing" && "Please wait while the list is extracted."}
          {(phase === "idle" || phase === "review") &&
            `List language: ${listLang?.label ?? "English"}. Product + quantity to order. Name + cost/rate for a quote.`}
        </p>

        {phase === "idle" || phase === "review" ? (
          <Button className="mt-6 w-full" size="lg" onClick={() => void startRec()}>
            <Mic className="size-4" />
            {phase === "review" ? "Speak again" : "Start speaking"}
          </Button>
        ) : null}
        {phase === "countdown" ? (
          <Button
            className="mt-6 w-full"
            variant="outline"
            size="lg"
            onClick={() => {
              sessionRef.current += 1;
              streamRef.current?.getTracks().forEach((t) => t.stop());
              setPhase("idle");
            }}
          >
            Cancel
          </Button>
        ) : null}
        {phase === "recording" ? (
          <Button className="mt-6 w-full" variant="danger" size="lg" onClick={() => void stopAndParse()}>
            <Square className="size-4" />
            Stop and show list
          </Button>
        ) : null}
        {phase === "parsing" ? <p className="mt-6 text-sm font-medium text-accent">Please wait…</p> : null}
        {live ? <p className="mt-4 text-left text-sm text-muted">{live}</p> : null}
      </div>

      <div className="mx-auto mt-6 max-w-md">
        <label className="text-xs text-muted">Or type the list</label>
        <textarea
          value={transcript}
          onChange={(e) => {
            transcriptRef.current = e.target.value;
            setTranscript(e.target.value);
          }}
          rows={3}
          placeholder={samplesFor(vendor.industry)[0]}
          className="mt-1 w-full rounded-[var(--radius-md)] border border-line bg-surface p-3 text-sm"
        />
        <Button
          className="mt-2 w-full"
          variant="outline"
          disabled={phase === "parsing" || phase === "countdown" || phase === "recording"}
          onClick={() => void stopAndParse(transcriptRef.current)}
        >
          Parse typed list
        </Button>
        {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
        {warning ? <p className="mt-2 text-sm text-warn">{warning}</p> : null}
      </div>

      {(phase === "review" || lines.length > 0) && (
        <div ref={listRef} className="mx-auto mt-8 max-w-lg space-y-2">
          <h2 className="font-display text-2xl tracking-tight">Extracted list</h2>
          {transcript ? (
            <p className="rounded-[var(--radius-md)] bg-accent-soft px-3 py-2 text-sm">
              You said: <span className="font-medium">{transcript}</span>
            </p>
          ) : null}
          {lines.length === 0 ? (
            <p className="text-sm text-muted">No lines yet. Speak or type a product and quantity.</p>
          ) : (
            lines.map((line, i) => (
              <div key={line.id} className="rounded-[var(--radius-lg)] border border-line bg-surface p-4">
                <div className="flex items-center justify-between gap-2">
                  <StatusPill status={line.kind} />
                  <span className="text-xs text-subtle">As spoken</span>
                </div>
                <input
                  className="mt-2 h-11 w-full rounded-[var(--radius-sm)] border border-line bg-bg px-3 text-sm"
                  value={line.productName}
                  onChange={(e) => {
                    const next = lines.slice();
                    next[i] = { ...line, productName: e.target.value };
                    setLines(next);
                  }}
                />
                <div className="mt-2 flex gap-2">
                  <input
                    type="number"
                    className="h-11 w-24 rounded-[var(--radius-sm)] border border-line bg-bg px-3 text-sm"
                    value={line.quantity ?? ""}
                    placeholder="Qty"
                    onChange={(e) => {
                      const next = lines.slice();
                      next[i] = { ...line, quantity: e.target.value === "" ? null : Number(e.target.value) };
                      setLines(next);
                    }}
                  />
                  <input
                    className="h-11 w-24 rounded-[var(--radius-sm)] border border-line bg-bg px-3 text-sm"
                    value={line.unit}
                    onChange={(e) => {
                      const next = lines.slice();
                      next[i] = { ...line, unit: e.target.value };
                      setLines(next);
                    }}
                  />
                  {line.kind === "inquiry" ? (
                    <span className="self-center text-xs text-muted">qty for quote</span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-subtle">{line.raw}</p>
              </div>
            ))
          )}
          <Button className="w-full" size="lg" onClick={() => void send()} disabled={!lines.length}>
            Send list to {vendor.shop}
          </Button>
        </div>
      )}
    </>
  );
}

function ListenDial({ mode, count }: { mode: "idle" | "ready" | "listen" | "wait"; count: number }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const progress =
    mode === "ready" ? Math.max(0, Math.min(1, count / READY_SECS)) : mode === "listen" ? 1 : mode === "wait" ? 0.28 : 1;
  const offset = circ * (1 - progress);
  const hot = mode === "listen";
  const elapsed = `${Math.floor(count / 60)}:${String(count % 60).padStart(2, "0")}`;
  return (
    <div className="relative mx-auto size-36">
      {hot ? <span className="vaani-listen-ring absolute inset-0 rounded-full bg-danger/25" /> : null}
      <svg className={`size-36 ${mode === "wait" ? "vaani-spin" : ""}`} viewBox="0 0 120 120" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--color-line)" strokeWidth="6" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={hot ? "var(--color-danger)" : "var(--color-accent)"}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div
        className={`absolute inset-5 flex flex-col items-center justify-center rounded-full ${
          hot ? "bg-danger text-accent-fg" : "bg-accent-soft text-accent"
        }`}
      >
        {mode === "ready" ? (
          <>
            <span className="font-display text-3xl leading-none tabular-nums">{count}</span>
            <span className="mt-0.5 text-[10px] uppercase tracking-wide opacity-80">Wait</span>
          </>
        ) : mode === "listen" ? (
          <>
            <span className="font-display text-2xl leading-none tabular-nums">{elapsed}</span>
            <span className="mt-0.5 text-[10px] uppercase tracking-wide opacity-80">Live</span>
          </>
        ) : mode === "wait" ? (
          <span className="text-xs font-medium">Wait</span>
        ) : (
          <Mic className="size-10" />
        )}
      </div>
    </div>
  );
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function blobToB64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      resolve(s.split(",")[1] ?? "");
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

type BrowserSpeech = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: (ev: { results: ArrayLike<{ 0: { transcript: string } }> }) => void;
  start: () => void;
  stop: () => void;
};
