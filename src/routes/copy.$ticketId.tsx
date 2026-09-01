import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getTicket, saveTicket } from "@/lib/vaani/account";
import { useT } from "@/lib/vaani/i18n";
import { readLastTicket, useVaani, vendorById } from "@/lib/vaani/store";

export const Route = createFileRoute("/copy/$ticketId")({ component: CopyPage });

function CopyPage() {
  const { ticketId } = Route.useParams();
  const role = useVaani((s) => s.role);
  const { t, industry: tradeLabel, locale } = useT();
  const liveVendors = useVaani((s) => s.liveVendors);
  const found = useVaani(
    (s) => s.tickets.find((t) => t.id === ticketId) ?? s.incoming.find((t) => t.id === ticketId),
  );
  const upsertTicket = useVaani((s) => s.upsertTicket);
  const upsertIncoming = useVaani((s) => s.upsertIncoming);
  const [lookup, setLookup] = useState<"wait" | "missing" | "ok">(found ? "ok" : "wait");

  useEffect(() => {
    if (found?.orderCopy) {
      setLookup("ok");
      return;
    }
    const last = readLastTicket();
    if (last && last.id === ticketId) {
      if (role === "vendor") upsertIncoming(last);
      else upsertTicket(last);
      setLookup("ok");
      return;
    }
    void getTicket({ data: { id: ticketId } })
      .then((t) => {
        if (t) {
          if (role === "vendor") upsertIncoming(t);
          else upsertTicket(t);
          setLookup("ok");
        } else setLookup(found ? "ok" : "missing");
      })
      .catch(() => setLookup(found ? "ok" : "missing"));
  }, [found, ticketId, role, upsertTicket, upsertIncoming]);

  const ticket = found;

  if (lookup === "wait" && !ticket) {
    return (
      <>
        <p className="text-sm text-muted">{t("loadingCopy")}</p>
      </>
    );
  }

  if (!ticket) {
    return (
      <>
        <p>{t("copyNotFound")}</p>
        <Link to={role === "vendor" ? "/vendor" : "/"} className="mt-3 inline-block text-sm text-accent">
          {t("back")}
        </Link>
      </>
    );
  }

  const vendor = vendorById(ticket.vendorId) ?? liveVendors.find((v) => v.id === ticket.vendorId);
  const accepted = ticket.lines.filter((l) => l.status === "accepted" || l.status === "confirmed");
  const quoted = ticket.lines.filter((l) => l.status === "quoted");
  const rejected = ticket.lines.filter((l) => l.status === "rejected");

  return (
    <>
      <div className="no-print mb-4 flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => window.print()}>
          {t("printPdf")}
        </Button>
        <Link to="/ticket/$ticketId" params={{ ticketId: ticket.id }} className="inline-flex h-11 items-center text-sm text-muted">
          {t("backToList")}
        </Link>
        {role === "vendor" && ticket.status === "finalized" ? (
          <Button
            variant="outline"
            onClick={() => {
              const next = { ...ticket, status: "delivered" as const, updatedAt: new Date().toISOString() };
              if (role === "vendor") upsertIncoming(next);
              else upsertTicket(next);
              void saveTicket({ data: { ticket: next } }).catch(() => undefined);
            }}
          >
            {t("delivered")}
          </Button>
        ) : null}
        {ticket.status === "delivered" ? (
          <span className="inline-flex h-11 items-center text-sm text-ok">{t("delivered")}</span>
        ) : null}
      </div>

      <article className="rounded-[var(--radius-xl)] border border-line bg-surface p-6 md:p-10">
        <div className="flex items-start justify-between gap-4 border-b border-line pb-5">
          <div>
            <p className="font-display text-3xl tracking-tight">Vaani</p>
            <p className="text-xs uppercase tracking-[0.16em] text-muted">{t("orderCopy")}</p>
          </div>
          <p className="text-right text-xs text-muted">
            {new Date(ticket.createdAt).toLocaleString(locale)}
            <br />
            {ticket.id.slice(0, 8).toUpperCase()}
          </p>
        </div>

        <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">{t("vendor")}</p>
            <p className="font-medium">{vendor?.shop || vendor?.name || t("vendor")}</p>
            {vendor?.name && vendor.name !== vendor.shop ? <p className="text-muted">{vendor.name}</p> : null}
            <p className="text-muted">{vendor?.phone}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">{t("customer")}</p>
            <p className="font-medium">{ticket.customerName}</p>
            <p className="text-muted">{ticket.customerPhone}</p>
            <p className="text-muted">{vendor ? tradeLabel(vendor.industry) : ""}</p>
          </div>
        </div>

        {accepted.length > 0 ? (
          <section className="mt-8">
            <h2 className="font-display text-xl">{t("accepted")}</h2>
            <table className="mt-2 w-full text-sm">
              <tbody>
                {accepted.map((l) => (
                  <tr key={l.id} className="border-b border-line">
                    <td className="py-2">{l.productName}</td>
                    <td className="py-2 text-right">
                      {l.quantity != null ? `${l.quantity} ${l.unit}` : l.unit}
                    </td>
                    <td className="py-2 text-right">
                      {l.quotedPrice != null ? `₹${l.quotedPrice}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        {quoted.length > 0 ? (
          <section className="mt-8">
            <h2 className="font-display text-xl">{t("quotedAwaiting")}</h2>
            <table className="mt-2 w-full text-sm">
              <tbody>
                {quoted.map((l) => (
                  <tr key={l.id} className="border-b border-line">
                    <td className="py-2">{l.productName}</td>
                    <td className="py-2 text-right">
                      {l.quantity != null ? `${l.quantity} ${l.unit}` : l.unit}
                    </td>
                    <td className="py-2 text-right">₹{l.quotedPrice} / {l.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        {rejected.length > 0 ? (
          <section className="mt-8">
            <h2 className="font-display text-xl">{t("rejected")}</h2>
            <ul className="mt-2 space-y-1 text-sm text-muted">
              {rejected.map((l) => (
                <li key={l.id}>
                  {l.productName}
                  {l.rejectReason ? ` — ${l.rejectReason}` : ""}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className="mt-8 text-xs text-subtle">
          {t("copyDisclaimer")}
        </p>
      </article>
    </>
  );
}
