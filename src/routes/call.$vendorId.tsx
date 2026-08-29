import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { saveTicket } from "@/lib/vaani/account";
import { parseVoiceOrder } from "@/lib/vaani/ai";
import { fallbackParse } from "@/lib/vaani/match";
import { LANGUAGES, formatInPhone, phoneDigits, samplesFor } from "@/lib/vaani/seed";
import { useT } from "@/lib/vaani/i18n";
import { findOpenTicket, liveLoginTen, pushIncomingToVendor, readLoginTen, useVaani, vendorById } from "@/lib/vaani/store";
import type { LineItem, Ticket } from "@/lib/vaani/types";

export const Route = createFileRoute("/call/$vendorId")({ component: CallRoute });

const READY_SECS = 3;

function CallRoute() {
  const { vendorId } = Route.useParams();
  return <CallScreen vendorId={vendorId} />;
}

export function CallScreen({ vendorId }: { vendorId: string }) {
  const liveVendors = useVaani((s) => s.liveVendors);
  const found = vendorById(vendorId) ?? liveVendors.find((v) => v.id === vendorId);
  const navigate = useNavigate();
  const customerName = useVaani((s) => s.customerName);
  const customerPhone = useVaani((s) => s.customerPhone);
  const language = useVaani((s) => s.language);
  const { t, industry: tradeLabel } = useT();
  const upsertTicket = useVaani((s) => s.upsertTicket);
  const removeTicket = useVaani((s) => s.removeTicket);
  const setCallVendorId = useVaani((s) => s.setCallVendorId);

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
  const draftIdRef = useRef("");

  function persistDraft(nextLines: LineItem[], nextTranscript: string) {
    const vendor = vendorRef.current;
    if (!vendor || !nextLines.length) return;
    const loginTen = liveLoginTen() || readLoginTen();
    const vendorTen = phoneDigits(vendor.phone) || String(vendor.id).match(/(\d{10})/)?.[1] || "";
    const existing =
      useVaani.getState().tickets.find((t) => t.id === draftIdRef.current) ||
      useVaani.getState().tickets.find((t) => t.vendorId === vendor.id && t.status === "draft");
    const id = existing?.id || draftIdRef.current || crypto.randomUUID();
    draftIdRef.current = id;
    const ticket: Ticket = {
      id,
      vendorId: vendor.id,
      vendorShop: vendor.shop,
      vendorPhone: formatInPhone(vendorTen || vendor.phone),
      customerName: customerName || "Shop",
      customerPhone: formatInPhone(loginTen || customerPhone),
      language: language || "en-IN",
      transcript: nextTranscript,
      createdAt: existing?.createdAt || new Date().toISOString(),
      status: "draft",
      lines: nextLines,
      orderCopy: null,
      notes: existing?.notes || "",
      updatedAt: new Date().toISOString(),
    };
    upsertTicket(ticket);
  }

  useEffect(() => {
    const vendor = vendorRef.current;
    if (!vendor) return;
    const draft = useVaani.getState().tickets.find((t) => t.vendorId === vendor.id && t.status === "draft");
    if (!draft?.lines.length) return;
    draftIdRef.current = draft.id;
    setLines(draft.lines);
    setTranscript(draft.transcript);
    transcriptRef.current = draft.transcript;
    setPhase("review");
  }, [vendorId]);

  useEffect(() => {
    if (phase !== "review" || !lines.length) return;
    persistDraft(lines, transcriptRef.current || transcript);
  }, [lines, phase, transcript]);

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
      setError(t("micBlocked"));
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
      persistDraft(localLines, spoken);
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
      persistDraft(fallbackParse(text), text);
      queueMicrotask(() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (err) {
      if (localLines.length) {
        setWarning(err instanceof Error ? err.message : t("showingSpoken"));
        return;
      }
      setError(err instanceof Error ? err.message : t("couldNotRead"));
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
    const loginTen = liveLoginTen() || readLoginTen();
    const vendorTen = phoneDigits(vendor.phone) || String(vendor.id).match(/(\d{10})/)?.[1] || "";
    if (vendorTen && loginTen && vendorTen === loginTen) {
      setError(t("vendorNotFound"));
      return;
    }
    const orderPhone = formatInPhone(loginTen || customerPhone);
    const vendorShop =
      vendorTen !== loginTen && vendor.shop === (customerName || "").trim()
        ? `Shop ${vendorTen}`
        : vendor.shop;
    const vendorPhone = formatInPhone(vendorTen || vendor.phone);
    const tickets = useVaani.getState().tickets;
    const draft =
      tickets.find((t) => t.id === draftIdRef.current && t.status === "draft") ||
      tickets.find((t) => t.vendorId === vendor.id && t.status === "draft");
    const openSent = tickets.find(
      (t) =>
        t.vendorId === vendor.id &&
        t.status !== "draft" &&
        t.status !== "finalized" &&
        t.status !== "delivered",
    );
    if (openSent) {
      const next: Ticket = {
        ...openSent,
        vendorId: vendor.id,
        vendorShop,
        vendorPhone,
        transcript: [openSent.transcript, transcript].filter(Boolean).join("\n"),
        lines: [...openSent.lines, ...lines],
        status: openSent.lines.some((l) => l.status !== "pending") ? "reviewing" : "sent",
        orderCopy: null,
        updatedAt: new Date().toISOString(),
      };
      upsertTicket(next);
      if (draft) removeTicket(draft.id);
      pushIncomingToVendor(vendorPhone || vendorTen, vendor.id, next);
      setCallVendorId("");
      try {
        await saveTicket({ data: { ticket: next } });
      } catch {
        /* local copy still held */
      }
      void navigate({ to: "/ticket/$ticketId", params: { ticketId: next.id } });
      return;
    }
    if (draft) {
      const next: Ticket = {
        ...draft,
        vendorId: vendor.id,
        vendorShop,
        vendorPhone,
        transcript,
        lines,
        status: "sent",
        orderCopy: null,
        updatedAt: new Date().toISOString(),
      };
      upsertTicket(next);
      pushIncomingToVendor(vendorPhone || vendorTen, vendor.id, next);
      setCallVendorId("");
      try {
        await saveTicket({ data: { ticket: next } });
      } catch {
        /* local copy still held */
      }
      void navigate({ to: "/ticket/$ticketId", params: { ticketId: next.id } });
      return;
    }
    const open = findOpenTicket(vendor.id);
    if (open) {
      const next: Ticket = {
        ...open,
        vendorId: vendor.id,
        vendorShop,
        vendorPhone,
        transcript: [open.transcript, transcript].filter(Boolean).join("\n"),
        lines: [...open.lines, ...lines],
        status: open.lines.some((l) => l.status !== "pending") ? "reviewing" : "sent",
        orderCopy: null,
        updatedAt: new Date().toISOString(),
      };
      upsertTicket(next);
      pushIncomingToVendor(vendorPhone || vendorTen, vendor.id, next);
      setCallVendorId("");
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
      vendorShop,
        vendorPhone,
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
    pushIncomingToVendor(vendorPhone || vendorTen, vendor.id, ticket);
    setCallVendorId("");
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
        <Button type="button" variant="outline" size="sm" onClick={() => setCallVendorId("")}>
          {t("back")}
        </Button>
        <p className="mt-3">{t("vendorNotFound")}</p>
      </>
    );
  }
  const vendor = found;
  const listLang = LANGUAGES.find((l) => l.id === (language || "en-IN"));
  const dialMode =
    phase === "countdown" ? "ready" : phase === "recording" ? "listen" : phase === "parsing" ? "wait" : "idle";

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setCallVendorId("")}>
        {t("back")}
      </Button>
      <p className="mt-4 text-xs font-medium uppercase tracking-[0.16em] text-muted">{t("calling")}</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight">{vendor.shop}</h1>
      <p className="text-sm text-muted">
        {vendor.name} · {vendor.phone} · {tradeLabel(vendor.industry)}
      </p>

      <div className="mx-auto mt-6 max-w-md rounded-[var(--radius-lg)] border border-line bg-surface p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          {t("examplePrefix", { name: tradeLabel(vendor.industry) })}
        </p>
        <p className="mt-1 text-xs text-muted">{t("exampleOrderHint")}</p>
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
          {phase === "idle" && t("connected")}
          {phase === "countdown" && t("waitStarting")}
          {phase === "recording" && t("listening")}
          {phase === "parsing" && t("waitReading")}
          {phase === "review" && t("yourList")}
        </p>
        <p className="mt-2 text-sm text-muted">
          {phase === "countdown" && t("readySpeak")}
          {phase === "recording" && t("speakListStop")}
          {phase === "parsing" && t("waitExtract")}
          {(phase === "idle" || phase === "review") &&
            t("listLangHint", { name: listLang?.label ?? t("asCustomer") })}
        </p>

        {phase === "idle" || phase === "review" ? (
          <Button className="mt-6 w-full" size="lg" onClick={() => void startRec()}>
            <Mic className="size-4" />
            {phase === "review" ? t("speakAgain") : t("startSpeaking")}
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
            {t("cancel")}
          </Button>
        ) : null}
        {phase === "recording" ? (
          <Button className="mt-6 w-full" variant="danger" size="lg" onClick={() => void stopAndParse()}>
            <Square className="size-4" />
            {t("stopShowList")}
          </Button>
        ) : null}
        {phase === "parsing" ? <p className="mt-6 text-sm font-medium text-accent">{t("pleaseWait")}</p> : null}
        {live ? <p className="mt-4 text-left text-sm text-muted">{live}</p> : null}
      </div>

      <div className="mx-auto mt-6 max-w-md">
        <label className="text-xs text-muted">{t("orType")}</label>
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
          {t("parseTyped")}
        </Button>
        {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
        {warning ? <p className="mt-2 text-sm text-warn">{warning}</p> : null}
      </div>

      {(phase === "review" || lines.length > 0) && (
        <div ref={listRef} className="mx-auto mt-8 max-w-lg space-y-2">
          <h2 className="font-display text-2xl tracking-tight">{t("extractedList")}</h2>
          {transcript ? (
            <p className="rounded-[var(--radius-md)] bg-accent-soft px-3 py-2 text-sm">
              {t("youSaid")} <span className="font-medium">{transcript}</span>
            </p>
          ) : null}
          {lines.length === 0 ? (
            <p className="text-sm text-muted">{t("noLines")}</p>
          ) : (
            lines.map((line, i) => (
              <div key={line.id} className="rounded-[var(--radius-lg)] border border-line bg-surface p-4">
                <div className="flex items-center justify-between gap-2">
                  <StatusPill status={line.kind} />
                  <span className="text-xs text-subtle">{t("asSpoken")}</span>
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
                    placeholder={t("qty")}
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
                    <span className="self-center text-xs text-muted">{t("qtyForQuote")}</span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-subtle">{line.raw}</p>
              </div>
            ))
          )}
          <Button className="w-full" size="lg" onClick={() => void send()} disabled={!lines.length}>
            {t("sendListTo", { shop: vendor.shop })}
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
