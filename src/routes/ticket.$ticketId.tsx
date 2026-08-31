import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { StatusPill } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { getTicket, saveTicket } from "@/lib/vaani/account";
import { composeOrderCopy } from "@/lib/vaani/ai";
import { useT } from "@/lib/vaani/i18n";
import { mergeOneTicket, useVaani, vendorById, vendorForPhone } from "@/lib/vaani/store";
import { phoneDigits } from "@/lib/vaani/seed";
import type { LineItem, Ticket, TicketStatus } from "@/lib/vaani/types";

export const Route = createFileRoute("/ticket/$ticketId")({ component: TicketPage });

function ticketStatusFromLines(lines: LineItem[]): TicketStatus {
  const accepted = lines.some((l) => l.status === "accepted" || l.status === "confirmed");
  const rejected = lines.some((l) => l.status === "rejected");
  if (lines.some((l) => l.status === "quoted")) return "quoted";
  if (lines.some((l) => l.status === "pending")) return "reviewing";
  if (lines.length > 0 && lines.every((l) => l.status === "rejected")) return "rejected";
  if (accepted && rejected) return "partial";
  return "confirmed";
}

function TicketPage() {
  const { ticketId } = Route.useParams();
  const navigate = useNavigate();
  const role = useVaani((s) => s.role);
  const language = useVaani((s) => s.language);
  const { t, industry: tradeLabel } = useT();
  const liveVendors = useVaani((s) => s.liveVendors);
  const customerName = useVaani((s) => s.customerName);
  const contacts = useVaani((s) => s.contacts);
  const found = useVaani(
    (s) => s.tickets.find((t) => t.id === ticketId) ?? s.incoming.find((t) => t.id === ticketId),
  );
  const upsertTicket = useVaani((s) => s.upsertTicket);
  const upsertIncoming = useVaani((s) => s.upsertIncoming);
  const updateLines = useVaani((s) => s.updateLines);
  const setOrderCopy = useVaani((s) => s.setOrderCopy);
  const [busy, setBusy] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [lookup, setLookup] = useState<"wait" | "missing" | "ok">(found ? "ok" : "wait");
  const foundRef = useRef(found);
  foundRef.current = found;

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const t = await getTicket({ data: { id: ticketId } });
        if (!alive) return;
        if (t) {
          const local = foundRef.current;
          const localTs = local ? Date.parse(local.updatedAt || local.createdAt) || 0 : 0;
          const remoteTs = Date.parse(t.updatedAt || t.createdAt) || 0;
          if (local && localTs > remoteTs) {
            setLookup("ok");
            return;
          }
          const merged = mergeOneTicket(local, t);
          if (role === "vendor") upsertIncoming(merged);
          else upsertTicket(merged);
          setLookup("ok");
          return;
        }
        if (foundRef.current) setLookup("ok");
        else setLookup("missing");
      } catch {
        if (!alive) return;
        if (foundRef.current) setLookup("ok");
        else setLookup("missing");
      }
    }
    void load();
    const id = window.setInterval(() => void load(), 5000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [ticketId, role, upsertTicket, upsertIncoming]);

  if (lookup === "wait" && !found) {
    return (
      <>
        <p className="text-sm text-muted">{t("loadingList")}</p>
      </>
    );
  }
  if (lookup === "missing" && !found) {
    return (
      <>
        <BackLink role={role} />
        <p className="mt-4">{t("requestNotFound")}</p>
      </>
    );
  }
  if (!found) {
    return (
      <>
        <p className="text-sm text-muted">{t("loadingList")}</p>
      </>
    );
  }
  const ticket = found;
  const locked = ticket.status === "finalized" || ticket.status === "delivered";

  const vendor =
    vendorForPhone(ticket.vendorPhone || "") ||
    vendorById(ticket.vendorId) ||
    liveVendors.find((v) => v.id === ticket.vendorId);
  const vendorTen = phoneDigits(ticket.vendorPhone || vendor?.phone || "");
  const mine = (customerName || "").trim();
  const listedShop = (vendor?.shop || "").trim();
  const stampedShop = (ticket.vendorShop || "").trim();
  const bookName = contacts.find((c) => phoneDigits(c.phone) === vendorTen)?.name.trim() || "";
  const clean = (name: string) => name && name !== mine && !/^Shop \d{10}$/.test(name) ? name : "";
  const customerVendorTitle = clean(listedShop) || clean(stampedShop) || bookName || stampedShop || listedShop || t("vendor");
  const pending = ticket.lines.some((l) => l.status === "pending");
  const waitingOnPrice = ticket.lines.some((l) => l.status === "quoted");
  const vendorReady =
    ticket.lines.length > 0 &&
    !pending &&
    ticket.lines.some((l) => l.status === "accepted" || l.status === "quoted" || l.status === "confirmed");

  function persist(next: Ticket) {
    const stamped = { ...next, updatedAt: new Date().toISOString() };
    if (role === "vendor") upsertIncoming(stamped);
    else upsertTicket(stamped);
    return saveTicket({ data: { ticket: stamped } }).catch(() => ({ ok: false as const }));
  }

  async function patch(i: number, part: Partial<LineItem>) {
    const line = ticket.lines[i];
    if (!line || acting) return;
    setActing(line.id);
    setErr(null);
    const lines = ticket.lines.map((l, idx) => (idx === i ? { ...l, ...part } : l));
    const status = ticketStatusFromLines(lines);
    updateLines(ticket.id, lines, status);
    const res = await persist({ ...ticket, lines, status });
    setActing(null);
    if (res && "ok" in res && res.ok === false) setErr(t("couldNotSave"));
  }

  async function finalize() {
    setBusy(true);
    setErr(null);
    const res = await composeOrderCopy({
      data: {
        shop: vendor?.shop ?? "Vendor",
        vendor: vendor?.name ?? vendor?.shop ?? "Vendor",
        customer: ticket.customerName,
        industry: vendor?.industry ?? "grocery",
        language: language || ticket.language || "en-IN",
        lines: ticket.lines,
      },
    });
    setBusy(false);
    if (!res.ok) {
      setErr(t("couldNotCompose"));
      return;
    }
    setOrderCopy(ticket.id, res.text);
    await persist({ ...ticket, orderCopy: res.text, status: "finalized" });
    void navigate({ to: "/copy/$ticketId", params: { ticketId: ticket.id } });
  }

  async function markDelivered() {
    setBusy(true);
    await persist({ ...ticket, status: "delivered" });
    setBusy(false);
  }

  function qtyLabel(line: LineItem) {
    const qty = line.quantity != null ? `${line.quantity} ${line.unit}` : line.unit;
    return line.kind === "order" ? t("qtyLabel", { qty }) : t("quoteFor", { qty });
  }

  return (
    <>
      <BackLink role={role} />
      <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-muted">
        {role === "vendor" ? t("incomingList") : t("sentList")}
      </p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl tracking-tight md:text-4xl">
            {role === "vendor" ? ticket.customerName || t("customer") : customerVendorTitle}
          </h1>
          <p className="text-sm text-muted">
            {role === "vendor" ? ticket.customerPhone : ticket.vendorPhone || vendor?.phone || ""}
            {vendor ? ` · ${tradeLabel(vendor.industry)}` : ""}
          </p>
        </div>
        <StatusPill status={ticket.status} />
      </div>

      {ticket.transcript ? (
        <blockquote className="mt-5 rounded-[var(--radius-lg)] border border-line bg-surface px-4 py-3 text-sm text-muted">
          {ticket.transcript}
        </blockquote>
      ) : null}

      <ul className="mt-6 space-y-3">
        {ticket.lines.map((line, i) => {
          return (
            <li key={line.id} className="rounded-[var(--radius-lg)] border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-2">
                  <StatusPill status={line.kind} />
                  <StatusPill status={line.status} />
                </div>
              </div>
              <p className="mt-2 font-medium">{line.productName}</p>
              <p className="text-sm text-muted">{qtyLabel(line)}</p>
              {line.quotedPrice != null ? (
                <p className="mt-1 text-sm">{t("quotedAt", { price: line.quotedPrice, unit: line.unit })}</p>
              ) : null}
              {line.rejectReason ? <p className="text-sm text-danger">{line.rejectReason}</p> : null}

              {role === "vendor" && !locked ? (
                <VendorActions
                  line={line}
                  busy={acting === line.id}
                  onAccept={() => void patch(i, { status: "accepted", rejectReason: null, quotedPrice: null })}
                  onReject={() => void patch(i, { status: "rejected" })}
                  onQuote={(price) => void patch(i, { status: "quoted", quotedPrice: price, rejectReason: null })}
                />
              ) : null}

              {role === "customer" && line.status === "quoted" && line.quotedPrice != null && !locked ? (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                  <Button size="sm" disabled={acting === line.id} onClick={() => void patch(i, { status: "confirmed" })}>
                    {t("acceptPrice")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={acting === line.id}
                    onClick={() => void patch(i, { status: "rejected", rejectReason: t("priceNotAccepted") })}
                  >
                    {t("rejectPrice")}
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {role === "vendor" && pending && !locked ? (
        <p className="mt-4 text-sm text-muted">{t("acceptOrReject")}</p>
      ) : null}
      {role === "vendor" && !pending && waitingOnPrice && !locked ? (
        <p className="mt-4 text-sm text-muted">
          {t("waitingQuoteVendor")}
        </p>
      ) : null}
      {role === "customer" && waitingOnPrice && !locked ? (
        <p className="mt-4 text-sm text-muted">{t("waitingQuoteCustomer")}</p>
      ) : null}

      {role === "vendor" && !locked ? (
        <Button className="mt-6 w-full sm:w-auto" size="lg" disabled={!vendorReady || busy} onClick={() => void finalize()}>
          {busy ? t("writingCopy") : t("finalizeCopy")}
        </Button>
      ) : null}

      {ticket.status === "finalized" || ticket.orderCopy ? (
        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            to="/copy/$ticketId"
            params={{ ticketId: ticket.id }}
            className="inline-flex h-12 items-center rounded-[var(--radius-md)] bg-accent px-5 text-sm font-medium text-accent-fg"
          >
            {t("openCopy")}
          </Link>
          {role === "vendor" && ticket.status !== "delivered" ? (
            <Button size="lg" variant="outline" disabled={busy} onClick={() => void markDelivered()}>
              {busy ? t("saving") : t("delivered")}
            </Button>
          ) : null}
        </div>
      ) : null}
      {ticket.status === "delivered" ? <p className="mt-3 text-sm text-ok">{t("markedDelivered")}</p> : null}
      {err ? <p className="mt-3 text-sm text-danger">{err}</p> : null}
    </>
  );
}

function BackLink({ role }: { role: string }) {
  const { t } = useT();
  return (
    <Link
      to={role === "vendor" ? "/vendor" : "/"}
      className="inline-flex items-center gap-1 text-sm text-muted"
    >
      <ArrowLeft className="size-4" />
      {t("back")}
    </Link>
  );
}

function VendorActions({
  line,
  busy,
  onAccept,
  onReject,
  onQuote,
}: {
  line: LineItem;
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
  onQuote: (price: number) => void;
}) {
  const [price, setPrice] = useState(line.quotedPrice != null ? String(line.quotedPrice) : "");
  const { t } = useT();
  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
      {line.kind === "order" ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={line.status === "accepted" ? "primary" : "outline"} disabled={busy} onClick={onAccept}>
            {busy ? t("saving") : t("accept")}
          </Button>
          <Button size="sm" variant={line.status === "rejected" ? "danger" : "outline"} disabled={busy} onClick={onReject}>
            {t("reject")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <span className="self-center text-sm text-muted">
            {t("rupeeFor", { qty: line.quantity != null ? `${line.quantity} ${line.unit}` : line.unit })}
          </span>
          <input
            type="number"
            inputMode="decimal"
            placeholder={t("rate")}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="h-9 w-28 rounded-[var(--radius-sm)] border border-line bg-bg px-2 text-sm"
          />
          <Button size="sm" variant={line.status === "quoted" ? "primary" : "outline"} disabled={busy || !price} onClick={() => onQuote(Number(price))}>
            {t("quoteRate")}
          </Button>
          <Button size="sm" variant={line.status === "rejected" ? "danger" : "outline"} disabled={busy} onClick={onReject}>
            {t("reject")}
          </Button>
        </div>
      )}
    </div>
  );
}
