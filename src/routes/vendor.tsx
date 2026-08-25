import { createFileRoute, Link } from "@tanstack/react-router";
import { Inbox } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { StatusPill } from "@/components/app-shell";
import {
  DEFAULT_DATE_FILTER,
  filterByDate,
  groupByDate,
  OrderDateFilter,
  type DateFilter,
} from "@/components/order-date-filter";
import { ShopCard } from "@/components/shop-card";
import { openVendorInbox } from "@/lib/vaani/account";
import { INDUSTRY_LABEL } from "@/lib/vaani/seed";
import { readShopIdentity, useVaani, mergeTicketLists, isOwnCustomerOrder } from "@/lib/vaani/store";

export const Route = createFileRoute("/vendor")({ component: VendorHome });

function VendorHome() {
  const incoming = useVaani((s) => s.incoming);
  const customerName = useVaani((s) => s.customerName);
  const customerPhone = useVaani((s) => s.customerPhone);
  const industry = useVaani((s) => s.industry);
  const isVendor = useVaani((s) => s.isVendor);
  const setRole = useVaani((s) => s.setRole);
  const setClaimedVendor = useVaani((s) => s.setClaimedVendor);
  const replaceIncoming = useVaani((s) => s.replaceIncoming);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>(DEFAULT_DATE_FILTER);
  const opened = useRef("");

  const snap = readShopIdentity();
  const shopName = snap?.shopName || customerName;
  const shopIndustry = snap?.industry || industry;
  const listed = snap?.isVendor ?? isVendor;
  const inbox = incoming.filter((t) => !isOwnCustomerOrder(t, customerPhone));

  useEffect(() => {
    setRole("vendor");
  }, [setRole]);

  useEffect(() => {
    if (!shopIndustry) return;
    const key = `${shopIndustry}:${listed ? "1" : "0"}`;
    if (opened.current === key) return;
    opened.current = key;
    setBusy(true);
    setErr(null);
    void openVendorInbox({ data: { industry: shopIndustry, phone: customerPhone } })
      .then((res) => {
        if (!res.ok) {
          setErr(res.error);
          return;
        }
        setClaimedVendor(res.vendorId);
        replaceIncoming(mergeTicketLists(useVaani.getState().incoming, res.tickets));
      })
      .catch(() => setErr("Could not load incoming lists."))
      .finally(() => setBusy(false));
  }, [shopIndustry, listed, customerPhone, replaceIncoming, setClaimedVendor]);

  return (
    <>
      <div className="mb-6 grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">Vendor desk</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight">{shopName || "Your shop"}</h1>
          <p className="mt-2 text-sm text-muted">
            {shopIndustry ? INDUSTRY_LABEL[shopIndustry] : "Pick your trade in shop details"}
            {customerPhone ? ` · ${customerPhone}` : ""}
          </p>
          <p className="mt-2 max-w-prose text-sm text-muted">
            You are identified by this shop name, mobile, and trade — not another login.
            Other buyers who have your number send lists here.
          </p>
        </div>
        <ShopCard />
      </div>

      {!shopName || !shopIndustry || !listed ? (
        <div className="rounded-[var(--radius-xl)] border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
          <p className="font-medium">List yourself as a vendor</p>
          <p className="mt-1 text-sm text-muted">
            Save shop name, pick your industry, and tick “I sell on Vaani”. That is how
            buyers know which trade you serve.
          </p>
        </div>
      ) : inbox.length === 0 ? (
        <div className="rounded-[var(--radius-xl)] border border-dashed border-line-strong bg-surface px-6 py-16 text-center">
          <Inbox className="mx-auto size-8 text-subtle" />
          <p className="mt-3 font-medium">{busy ? "Loading incoming lists…" : "No incoming lists"}</p>
          <p className="mt-1 text-sm text-muted">
            Other buyers' {INDUSTRY_LABEL[shopIndustry]} orders for {shopName} land here.
          </p>
          {err ? <p className="mt-2 text-sm text-danger">{err}</p> : null}
        </div>
      ) : (
        <div>
          <h2 className="mb-3 font-display text-2xl tracking-tight">Incoming lists</h2>
          <OrderDateFilter value={dateFilter} onChange={setDateFilter} />
          {(() => {
            const rows = filterByDate(inbox, dateFilter);
            if (rows.length === 0) {
              return <p className="text-sm text-muted">No orders on these dates.</p>;
            }
            return (
              <div className="space-y-5">
                {groupByDate(rows).map((g) => (
                  <div key={g.key}>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{g.label}</p>
                    <ul className="space-y-2">
                      {g.tickets.map((t) => (
                        <li
                          key={t.id}
                          className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-line bg-surface px-4 py-4"
                        >
                          <Link to="/ticket/$ticketId" params={{ ticketId: t.id }} className="min-w-0 flex-1">
                            <p className="font-medium">{t.customerName || "Customer"}</p>
                            <p className="truncate text-xs text-muted">
                              {t.lines.length} lines · {t.customerPhone} ·{" "}
                              {new Date(t.createdAt).toLocaleString("en-IN")}
                            </p>
                          </Link>
                          <div className="flex shrink-0 items-center gap-2">
                            {t.status === "finalized" || t.orderCopy ? (
                              <Link
                                to="/copy/$ticketId"
                                params={{ ticketId: t.id }}
                                className="text-xs font-medium text-accent"
                              >
                                Copy
                              </Link>
                            ) : null}
                            <StatusPill status={t.status} />
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
