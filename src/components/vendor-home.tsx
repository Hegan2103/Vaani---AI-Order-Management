import { listIncomingTickets } from "@/lib/vaani/account";
import { inboxIdForUser, formatInPhone, phoneDigits } from "@/lib/vaani/seed";
import { Link } from "@tanstack/react-router";
import { Inbox } from "lucide-react";
import { useEffect, useState } from "react";
import { StatusPill } from "@/components/status-pill";
import {
  DEFAULT_DATE_FILTER,
  filterByDate,
  groupByDate,
  OrderDateFilter,
  type DateFilter,
} from "@/components/order-date-filter";
import { ShopCard } from "@/components/shop-card";
import { ReminderButton } from "@/components/reminder-dialog";
import { useT } from "@/lib/vaani/i18n";
import { mergeTicketLists, readAccountBackup, readLoginTen, readShopIdentity, readVendorInbox, useVaani, isOwnCustomerOrder, liveLoginTen } from "@/lib/vaani/store";

export function VendorHome() {
  const incoming = useVaani((s) => s.incoming);
  const customerName = useVaani((s) => s.customerName);
  const customerPhone = useVaani((s) => s.customerPhone);
  const industry = useVaani((s) => s.industry);
  const isVendor = useVaani((s) => s.isVendor);
  const contacts = useVaani((s) => s.contacts);
  const [dateFilter, setDateFilter] = useState<DateFilter>(DEFAULT_DATE_FILTER);
  const { t, industry: tradeLabel, locale } = useT();

 const ten = (liveLoginTen?.() || String(customerPhone || "").replace(/\D/g, "").slice(-10));
  const snap = readShopIdentity(ten);
  const shopName = snap?.shopName || "";
  const shopIndustry = snap?.industry || industry;
  const listed = snap?.isVendor ?? isVendor;
  const inbox = incoming.filter((t) => t.status !== "draft" && !isOwnCustomerOrder(t, customerPhone));
  useEffect(() => {
    if (ten.length !== 10) return;
    const local = mergeTicketLists(readVendorInbox(ten), readAccountBackup(ten)?.incoming ?? []);
    if (local.length) useVaani.setState({ incoming: local });
    const vendorId = inboxIdForUser(`vaani-${ten}`);
    void listIncomingTickets({ data: { vendorId } })
      .then((rows) => {
        if (!Array.isArray(rows) || !rows.length) return;
        useVaani.setState({ incoming: mergeTicketLists(useVaani.getState().incoming, rows) });
      })
      .catch(() => {
        /* local inbox still used */
      });
  }, [ten]);

  return (
    <>
      <div className="mb-6 grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">{t("vendorDesk")}</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight">{shopName || t("yourShopFallback")}</h1>
          <p className="mt-2 text-sm text-muted">
            {shopIndustry ? tradeLabel(shopIndustry) : t("pickTradeHint")}
            {customerPhone ? ` · ${customerPhone}` : ""}
          </p>
          <p className="mt-2 max-w-prose text-sm text-muted">{t("vendorIdentified")}</p>
        </div>
        <ShopCard />
      </div>

      {contacts.filter((c) => phoneDigits(c.phone).length === 10 && phoneDigits(c.phone) !== ten).length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 font-display text-2xl tracking-tight">{t("setReminder")}</h2>
          <ul className="divide-y divide-line rounded-[var(--radius-xl)] border border-line bg-surface">
            {contacts
              .filter((c) => phoneDigits(c.phone).length === 10 && phoneDigits(c.phone) !== ten)
              .slice(0, 40)
              .map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="truncate text-xs text-muted">{formatInPhone(phoneDigits(c.phone))}</p>
                  </div>
                  <ReminderButton contactName={c.name} contactPhone={c.phone} notifyBoth />
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      {inbox.length === 0 && (!shopName || !shopIndustry || !listed) ? (
        <div className="rounded-[var(--radius-xl)] border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
          <p className="font-medium">{t("listYourself")}</p>
          <p className="mt-1 text-sm text-muted">{t("listYourselfHint")}</p>
        </div>
      ) : inbox.length === 0 ? (
        <div className="rounded-[var(--radius-xl)] border border-dashed border-line-strong bg-surface px-6 py-16 text-center">
          <Inbox className="mx-auto size-8 text-subtle" />
          <p className="mt-3 font-medium">{t("noIncoming")}</p>
          <p className="mt-1 text-sm text-muted">
            {t("noIncomingHint", { industry: tradeLabel(shopIndustry), shop: shopName })}
          </p>
        </div>
      ) : (
        <div>
          <h2 className="mb-3 font-display text-2xl tracking-tight">{t("incomingLists")}</h2>
          <OrderDateFilter value={dateFilter} onChange={setDateFilter} />
          {(() => {
            const rows = filterByDate(inbox, dateFilter);
            if (rows.length === 0) {
              return <p className="text-sm text-muted">{t("noOrdersDates")}</p>;
            }
            return (
              <div className="space-y-5">
                {groupByDate(rows, t("today"), t("yesterday"), locale).map((g) => (
                  <div key={g.key}>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{g.label}</p>
                    <ul className="space-y-2">
                      {g.tickets.map((row) => (
                        <li
                          key={row.id}
                          className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-line bg-surface px-4 py-4"
                        >
                          <Link to="/ticket/$ticketId" params={{ ticketId: row.id }} className="min-w-0 flex-1">
                            <p className="font-medium">{row.customerName || t("customer")}</p>
                            <p className="truncate text-xs text-muted">
                              {t("linesCount", { n: row.lines.length })} · {row.customerPhone} ·{" "}
                              {new Date(row.createdAt).toLocaleString(locale)}
                            </p>
                          </Link>
                          <div className="flex shrink-0 items-center gap-2">
                            {row.status === "finalized" || row.orderCopy ? (
                              <Link
                                to="/copy/$ticketId"
                                params={{ ticketId: row.id }}
                                className="text-xs font-medium text-accent"
                              >
                                {t("orderCopy")}
                              </Link>
                            ) : null}
                            <StatusPill status={row.status} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}
    </>
  );
}
