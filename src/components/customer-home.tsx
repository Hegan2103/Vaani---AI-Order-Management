import { Link, useNavigate } from "@tanstack/react-router";
import { BookUser, Mic, Phone } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { StatusPill } from "@/components/status-pill";
import {
  DEFAULT_DATE_FILTER,
  filterByDate,
  groupByDate,
  OrderDateFilter,
  type DateFilter,
} from "@/components/order-date-filter";
import { keepSession } from "@/components/login-screen";
import { ShopCard } from "@/components/shop-card";
import { Button } from "@/components/ui/button";
import { INDUSTRY_LABEL, VENDORS, allIndustrySamples, formatInPhone, phoneDigits, samplesFor } from "@/lib/vaani/seed";
import { useT } from "@/lib/vaani/i18n";
import { listedVendors, readDirContacts, readLoginTen, rememberLoginTen, restoreLocalAccount, writeDirContacts, useVaani, vendorById, vendorForPhone } from "@/lib/vaani/store";
import type { Contact, Industry } from "@/lib/vaani/types";

export function CustomerHome() {
  const navigate = useNavigate();
  const setRole = useVaani((s) => s.setRole);
  const setCallVendorId = useVaani((s) => s.setCallVendorId);
  const contacts = useVaani((s) => s.contacts);
  const tickets = useVaani((s) => s.tickets);
  const customerPhone = useVaani((s) => s.customerPhone);
  const mergeContacts = useVaani((s) => s.mergeContacts);
  const liveVendors = useVaani((s) => s.liveVendors);
  const [q, setQ] = useState("");
  const [industry, setIndustry] = useState<Industry | "all">("all");
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>(DEFAULT_DATE_FILTER);
  const { t, industry: tradeLabel, locale } = useT();

  const meTen = phoneDigits(customerPhone) || readLoginTen();

  useEffect(() => {
    const rows = readDirContacts();
    if (rows && rows.length) useVaani.setState({ contacts: rows });
  }, []);

  const filtered = useMemo(() => {
    const dir = readDirContacts();
    const book = dir ?? contacts.filter((c) => c.source === "phone");
    const rows = dir != null || book.length ? book : contacts;
    return rows.filter((c) => {
      const v = vendorForPhone(c.phone);
      if (industry !== "all" && v?.industry && v.industry !== industry) return false;
      const hay = `${c.name} ${c.phone}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [contacts, q, industry, liveVendors, meTen]);

  async function pullDirectory() {
    const ten = readLoginTen() || phoneDigits(customerPhone);
    if (ten.length === 10) rememberLoginTen(ten);
    keepSession();
    const nav = navigator as Navigator & {
      contacts?: {
        select: (
          props: string[],
          opts: { multiple: boolean },
        ) => Promise<Array<{ name?: string[]; tel?: unknown[] }>>;
      };
    };
    try {
      if (!nav.contacts?.select) {
        setImportMsg(t("pullDirectory"));
        return;
      }
      const picked = await nav.contacts.select(["name", "tel"], { multiple: true });
      keepSession();
      restoreLocalAccount(ten);
      if (ten.length === 10) rememberLoginTen(ten);
      const extra: Contact[] = [];
      const seen = new Set<string>();
      for (const p of picked) {
        const tels = Array.isArray(p.tel) ? p.tel : p.tel ? [p.tel] : [];
        const bookName = Array.isArray(p.name)
          ? p.name.map(String).filter((n) => n.trim()).join(" ")
          : typeof p.name === "string"
            ? p.name
            : "";
        let added = false;
        for (const raw of tels) {
          const phone =
            typeof raw === "string"
              ? raw
              : raw && typeof raw === "object"
                ? String(
                    (raw as { value?: string; tel?: string; number?: string }).value ||
                      (raw as { tel?: string }).tel ||
                      (raw as { number?: string }).number ||
                      "",
                  )
                : String(raw ?? "");
          const digits = phoneDigits(phone);
          if (digits.length !== 10) continue;
          if (seen.has(digits)) continue;
          seen.add(digits);
          extra.push({
            id: crypto.randomUUID(),
            name: bookName.trim() || phone,
            phone,
            vendorId: vendorForPhone(phone)?.id ?? null,
            source: "phone",
          });
          added = true;
        }
        if (!added && bookName.trim()) {
          extra.push({
            id: crypto.randomUUID(),
            name: bookName.trim(),
            phone: tels.map(String).join(" ") || bookName,
            vendorId: null,
            source: "phone",
          });
        }
      }
      if (extra.length) writeDirContacts(extra);
      setImportMsg(t("importedN", { n: extra.length }));
    } catch {
      keepSession();
      restoreLocalAccount(ten);
      if (ten.length === 10) rememberLoginTen(ten);
    }
  }

  return (
    <>
      <section className="mb-8 grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">{t("forEveryShop")}</p>
          <h1 className="mt-2 font-display text-4xl leading-tight tracking-tight md:text-5xl">
            {t("speakOrder")}
            <br />
            {t("skipCall")}
          </h1>
          <p className="mt-3 max-w-prose text-sm text-muted">
            {customerPhone ? t("signedInAs", { phone: formatInPhone(customerPhone) }) : null}
          </p>
          <ol className="mt-3 max-w-prose list-decimal space-y-1.5 pl-5 text-sm text-muted">
            <li>{t("step1")}</li>
            <li>{t("step2")}</li>
            <li>
              {t("step3a")} <span className="text-ink">{t("step3qty")}</span> {t("step3b")}{" "}
              <span className="text-ink">{t("step3cost")}</span> {t("step3c")}
            </li>
            <li>{t("step4")}</li>
          </ol>
        </div>
        <ShopCard
          extra={
            <Button className="mt-4 w-full" variant="outline" onClick={() => void pullDirectory()}>
              <BookUser className="size-4" />
              {t("pullDirectory")}
            </Button>
          }
        />
      </section>

      {importMsg ? <p className="mb-3 text-sm text-ok">{importMsg}</p> : null}

      <div className="mb-3 flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="h-11 min-w-[12rem] flex-1 rounded-[var(--radius-md)] border border-line bg-surface px-3 text-sm"
        />
        <select
          value={industry}
          onChange={(e) => setIndustry(e.target.value as Industry | "all")}
          className="h-11 rounded-[var(--radius-md)] border border-line bg-surface px-3 text-sm"
        >
          <option value="all">{t("allTrades")}</option>
          {Object.keys(INDUSTRY_LABEL).map((k) => (
            <option key={k} value={k}>
              {tradeLabel(k as Industry)}
            </option>
          ))}
        </select>
      </div>

      <ul className="divide-y divide-line rounded-[var(--radius-xl)] border border-line bg-surface">
        {filtered.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-muted">{t("pullDirectory")}</li>
        ) : (
          filtered.map((c) => {
          const ten = phoneDigits(c.phone);
          const v = ten.length === 10 && ten !== meTen ? vendorForPhone(c.phone) : undefined;
          return (
            <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{c.name}</p>
                <p className="truncate text-xs text-muted">
                  {c.phone}
                  {v ? ` · ${tradeLabel(v.industry)}` : ""}
                </p>
              </div>
              {v ? (
                <Button
                  type="button"
                  size="sm"
                  className="h-9 rounded-full px-3"
                  onClick={() => {
                    const ten = readLoginTen();
                    if (ten.length === 10) rememberLoginTen(ten);
                    keepSession();
                    setRole("customer");
                    setCallVendorId(v.id);
                  }}
                >
                  <Phone className="size-3.5" />
                  {t("dial")}
                </Button>
              ) : (
                <span className="text-xs text-subtle">{t("notOnVaani")}</span>
              )}
            </li>
          );
        })
        )}
      </ul>

      <p className="mt-4 text-xs text-subtle">
        {t("voiceHint")}
      </p>

      {industry === "all" ? (
        <div className="mt-4 space-y-3">
          {allIndustrySamples().map((row) => (
            <div key={row.id}>
              <p className="text-xs font-medium text-muted">{t("examplePrefix", { name: tradeLabel(row.id as Industry) })}</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {row.samples.map((s) => (
                  <span key={s} className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-xs font-medium text-muted">{t("examplePrefix", { name: tradeLabel(industry) })}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {samplesFor(industry).map((s) => (
              <span key={s} className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {tickets.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-3 font-display text-2xl tracking-tight">{t("yourRequests")}</h2>
          <OrderDateFilter value={dateFilter} onChange={setDateFilter} />
          {(() => {
            const rows = filterByDate(tickets, dateFilter);
            if (rows.length === 0) {
              return <p className="text-sm text-muted">{t("noOrdersDates")}</p>;
            }
            return (
              <div className="space-y-5">
                {groupByDate(rows, t("today"), t("yesterday"), locale).map((g) => (
                  <div key={g.key}>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{g.label}</p>
                    <ul className="space-y-2">
                      {g.tickets.map((row) => {
                        const vend = vendorById(row.vendorId);
                        return (
                          <li key={row.id}>
                            <Link
                              to="/ticket/$ticketId"
                              params={{ ticketId: row.id }}
                              className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-line bg-surface px-4 py-4"
                              onClick={() => void navigate({ to: "/ticket/$ticketId", params: { ticketId: row.id } })}
                            >
                              <div className="min-w-0">
                                <p className="truncate font-medium">{vend?.shop ?? row.customerName}</p>
                                <p className="truncate text-xs text-muted">
                                  {t("linesCount", { n: row.lines.length })} · {new Date(row.createdAt).toLocaleString(locale)}
                                </p>
                              </div>
                              <StatusPill status={row.status} />
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            );
          })()}
        </section>
      ) : (
        <p className="mt-10 flex items-center gap-2 text-sm text-muted">
          <Mic className="size-4" />
          {customerPhone
            ? t("noOrdersYetPhone", { phone: formatInPhone(customerPhone) })
            : t("noOrdersYet")}
        </p>
      )}
    </>
  );
}
