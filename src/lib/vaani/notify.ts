import type { Ticket, VaaniNotice } from "./types";

export type VaaniEvent = VaaniNotice;

function ev(
  title: string,
  body: string,
  ticketId: string,
  audience: "customer" | "vendor",
): VaaniEvent {
  return {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    title,
    body,
    ticketId,
    read: false,
    audience,
  };
}

export function ticketFingerprint(tickets: Ticket[]) {
  const unique = new Map(tickets.map((t) => [t.id, t]));
  return [...unique.values()]
    .map(
      (t) =>
        `${t.id}:${t.status}:${t.orderCopy ? "1" : "0"}:${t.lines.map((l) => `${l.id}:${l.status}:${l.quotedPrice ?? ""}:${l.quantity ?? ""}`).join(",")}`,
    )
    .sort()
    .join("|");
}

export function diffTicketEvents(prev: Ticket[], next: Ticket[]): VaaniEvent[] {
  const prevMap = new Map(prev.map((t) => [t.id, t]));
  const nextMap = new Map(next.map((t) => [t.id, t]));
  const events: VaaniEvent[] = [];
  for (const t of nextMap.values()) {
    const old = prevMap.get(t.id);
    if (!old) {
      events.push(ev(`New list from ${t.customerName || "customer"}`, `${t.lines.length} lines`, t.id, "vendor"));
      continue;
    }
    if (old.status !== t.status && t.status === "finalized") {
      events.push(ev("Order copy ready", t.customerName || "List finalized", t.id, "customer"));
    }
    if (old.status !== t.status && t.status === "delivered") {
      events.push(ev("Marked delivered", t.customerName || "Order delivered", t.id, "customer"));
    }
    if (old.lines.length < t.lines.length) {
      events.push(
        ev(
          "List updated",
          `${t.lines.length - old.lines.length} new line(s) from ${t.customerName || "customer"}`,
          t.id,
          "vendor",
        ),
      );
    }
    for (const line of t.lines) {
      const before = old.lines.find((l) => l.id === line.id);
      if (!before || before.status === line.status) continue;
      if (line.status === "quoted") {
        events.push(
          ev(`${line.productName} quoted`, `₹${line.quotedPrice ?? "—"} for ${line.quantity ?? "—"} ${line.unit}`, t.id, "customer"),
        );
      } else if (line.status === "accepted") {
        events.push(ev(`${line.productName} accepted`, `Qty ${line.quantity ?? "—"} ${line.unit}`, t.id, "customer"));
      } else if (line.status === "confirmed") {
        events.push(ev("Price accepted", `${line.productName} · ₹${line.quotedPrice ?? "—"}`, t.id, "vendor"));
      } else if (line.status === "rejected") {
        const toCustomer = before.status === "pending" || before.status === "quoted";
        events.push(
          ev(
            `${line.productName} rejected`,
            line.rejectReason || "Not accepted",
            t.id,
            toCustomer && before.status === "pending" ? "customer" : before.status === "quoted" ? "customer" : "vendor",
          ),
        );
      }
    }
  }
  return events;
}

let audioCtx: AudioContext | null = null;

function contextCtor() {
  if (typeof window === "undefined") return null;
  return window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
}

export function unlockBeep() {
  if (typeof window === "undefined") return;
  try {
    const Ctor = contextCtor();
    if (!Ctor) return;
    if (!audioCtx) audioCtx = new Ctor();
    if (audioCtx.state === "suspended") void audioCtx.resume();
  } catch {
    /* ignore */
  }
}

export function playBeep() {
  if (typeof window === "undefined") return;
  try {
    unlockBeep();
    const ctx = audioCtx;
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    const ding = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t0 = ctx.currentTime + start;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.16, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.03);
    };
    ding(880, 0, 0.16);
    ding(1175, 0.12, 0.2);
  } catch {
    try {
      const beep = new Audio(
        "data:audio/wav;base64,UklGRlYAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YTIAAAAAADMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMz",
      );
      beep.volume = 0.5;
      void beep.play();
    } catch {
      /* audio blocked */
    }
  }
}