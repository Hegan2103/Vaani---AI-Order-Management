import { Link, useNavigate } from "@tanstack/react-router";
import { BookUser, Mic, Phone, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { StatusPill } from "@/components/status-pill";
import {
  DEFAULT_DATE_FILTER,
  filterByDate,
  groupByDate,
  OrderDateFilter,
  type DateFilter,
} from "@/components/order-date-filter";
import { keepSession, isSignedOut } from "@/components/login-screen";
import { ShopCard } from "@/components/shop-card";
import { ReminderButton } from "@/components/reminder-dialog";
import { Button } from "@/components/ui/button";
import { listTickets } from "@/lib/vaani/account";
import { INDUSTRY_LABEL, VENDORS, allIndustrySamples, formatInPhone, phoneDigits, samplesFor } from "@/lib/vaani/seed";
import { useT } from "@/lib/vaani/i18n";
import { bookNameFor, listedVendors, liveLoginTen, mergeTicketLists, readBookNames, readDirContacts, readLoginTen, rememberLoginTen, restoreLocalAccount, writeDirContacts, useVaani, vendorById, vendorForPhone } from "@/lib/vaani/store";
import type { Contact, Industry } from "@/lib/vaani/types";

export function CustomerHome() {
  const navigate = useNavigate();
  const setRole = useVaani((s) => s.setRole);
  const setCallVendorId = useVaani((s) => s.setCallVendorId);
  const contacts = useVaani((s) => s.contacts);
  const tickets = useVaani((s) => s.tickets);
  const removeTicket = useVaani((s) => s.removeTicket);
  const customerName = useVaani((s) => s.customerName);
  const customerPhone = useVaani((s) => s.customerPhone);
  const mergeContacts = useVaani((s) => s.mergeContacts);
  const liveVendors = useVaani((s) => s.liveVendors);
  const setLiveVendors = useVaani((s) => s.setLiveVendors);
  const [q, setQ] = useState("");
  const [industry, setIndustry] = useState<Industry | "all">("all");
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>(DEFAULT_DATE_FILTER);
  const [multiPick, setMultiPick] = useState<Array<{ name: string; numbers: Array<{ ten: string; display: string }> }>>([]);
  const [pickedTens, setPickedTens] = useState<Record<string, boolean>>({});
  const { t, industry: tradeLabel, locale } = useT();

  const meTen = liveLoginTen() || readLoginTen() || phoneDigits(customerPhone);

  useEffect(() => {
    const rows = readDirContacts();
    if (rows && rows.length) useVaani.setState({ contacts: rows });
  }, []);

  useEffect(() => {
    if (meTen.length !== 10) return;
    const pull = () => {
      if (isSignedOut()) return;
      void listTickets()
        .then((rows) => {
          if (!Array.isArray(rows) || !rows.length) return;
          useVaani.setState({ tickets: mergeTicketLists(useVaani.getState().tickets, rows) });
        })
        .catch(() => {
          /* local tickets */
        });
    };
    pull();
    const id = window.setInterval(pull, 4000);
    return () => window.clearInterval(id);
  }, [meTen]);

  const filtered = useMemo(() => {
    const dir = readDirContacts();
    const book = dir ?? contacts.filter((c) => c.source === "phone");
    let rows = dir != null || book.length ? [...book] : [...contacts];
    const names = readBookNames();
    if (!rows.length && Object.keys(names).length) {
      rows = Object.entries(names)
        .filter(([ten]) => ten.length === 10)
        .map(([ten, name]) => ({
          id: `book-${ten}`,
          name,
          phone: formatInPhone(ten),
          source: "phone" as const,
        }));
    }
    rows = rows.map((c) => ({ ...c, name: bookNameFor(c.phone, c.name) }));
    const seen = new Set(rows.map((c) => phoneDigits(c.phone)).filter((n) => n.length === 10));
    for (const v of listedVendors()) {
      const ten = phoneDigits(v.phone);
      if (ten.length !== 10 || ten === meTen || seen.has(ten)) continue;
      seen.add(ten);
      rows.push({
        id: v.id,
        name: bookNameFor(ten, v.shop || v.name),
        phone: v.phone,
        vendorId: v.id,
        source: "vaani",
      });
    }
    return rows.filter((c) => {
      const v = vendorForPhone(c.phone);
      if (industry !== "all" && v?.industry && v.industry !== industry) return false;
      const hay = `${c.name} ${c.phone}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [contacts, q, industry, liveVendors, meTen]);

  function telText(raw: unknown): string {
    if (typeof raw === "string") return raw;
    if (raw && typeof raw === "object") {
      return String(
        (raw as { value?: string; tel?: string; number?: string }).value ||
          (raw as { tel?: string }).tel ||
          (raw as { number?: string }).number ||
          "",
      );
    }
    return String(raw ?? "");
  }

  function commitContacts(rows: Contact[]) {
    if (!rows.length) return;
    writeDirContacts(rows);
    setImportMsg(t("importedN", { n: rows.length }));
  }

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
      const auto: Contact[] = [];
      const multi: Array<{ name: string; numbers: Array<{ ten: string; display: string }> }> = [];
      const seen = new Set<string>();
      for (const p of picked) {
        const tels = Array.isArray(p.tel) ? p.tel : p.tel ? [p.tel] : [];
        const bookName = Array.isArray(p.name)
          ? p.name.map(String).filter((n) => n.trim()).join(" ")
          : typeof p.name === "string"
            ? p.name
            : "";
        const numbers: Array<{ ten: string; display: string }> = [];
        for (const raw of tels) {
          const phone = telText(raw);
          const digits = phoneDigits(phone);
          if (digits.length !== 10) continue;
          if (numbers.some((n) => n.ten === digits)) continue;
          numbers.push({ ten: digits, display: formatInPhone(digits) });
        }
        if (numbers.length === 0) {
          if (bookName.trim()) {
            auto.push({
              id: crypto.randomUUID(),
              name: bookName.trim(),
              phone: tels.map((x) => telText(x)).join(" ") || bookName,
              vendorId: null,
              source: "phone",
            });
          }
          continue;
        }
        if (numbers.length === 1) {
          const n = numbers[0];
          if (!seen.has(n.ten)) {
            seen.add(n.ten);
            auto.push({
              id: crypto.randomUUID(),
              name: bookName.trim() || n.display,
              phone: n.display,
              vendorId: vendorForPhone(n.ten)?.id ?? null,
              source: "phone",
            });
          }
          continue;
        }
        multi.push({ name: bookName.trim() || numbers[0].display, numbers });
      }
      if (auto.length) commitContacts(auto);
      if (multi.length) {
        const flags: Record<string, boolean> = {};
        for (const c of multi) for (const n of c.numbers) flags[`${c.name}|${n.ten}`] = true;
        setPickedTens(flags);
        setMultiPick(multi);
      } else if (!auto.length) {
        setImportMsg(t("importedN", { n: 0 }));
      }
    } catch {
      keepSession();
      restoreLocalAccount(ten);
      if (ten.length === 10) rememberLoginTen(ten);
    }
  }

  function confirmPickedNumbers() {
    const extra: Contact[] = [];
    const seen = new Set<string>();
    for (const c of multiPick) {
      for (const n of c.numbers) {
        if (!pickedTens[`${c.name}|${n.ten}`]) continue;
        if (seen.has(n.ten)) continue;
        seen.add(n.ten);
        extra.push({
          id: crypto.randomUUID(),
          name: c.name,
          phone: n.display,
          vendorId: vendorForPhone(n.ten)?.id ?? null,
          source: "phone",
        });
      }
    }
    setMultiPick([]);
    if (extra.length) commitContacts(extra);
  }

  return (
    <>
      <section className="mb-8">
        <ShopCard
          extra={
            <Button className="mt-4 w-full" variant="outline" onClick={() => void pullDirectory()}>
              <BookUser className="size-4" />
              {t("pullDirectory")}
            </Button>
          }
        />
        <div className="mt-6">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">{t("forEveryShop")}</p>
          <h1 className="mt-2 font-display text-3xl leading-tight tracking-tight">
            {t("speakOrder")}
            <br />
            {t("skipCall")}
          </h1>
          <p className="mt-3 max-w-prose text-sm text-muted">
            {customerPhone ? t("signedInAs", { phone: formatInPhone(customerPhone) }) : null}
          </p>
        </div>
      </section>

      {multiPick.length > 0 ? (
        <div className="fixed inset-0 z-40 grid place-items-end bg-ink/40 p-4 sm:place-items-center">
          <div className="w-full max-w-md rounded-[var(--radius-xl)] border border-line bg-surface p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">{t("pickNumbersTitle")}</p>
            <p className="mt-1 text-sm text-muted">{t("pickNumbersHint")}</p>
            <ul className="mt-4 max-h-72 space-y-4 overflow-auto">
              {multiPick.map((c) => (
                <li key={c.name}>
                  <p className="font-medium">{c.name}</p>
                  <div className="mt-2 space-y-2">
                    {c.numbers.map((n) => {
                      const key = `${c.name}|${n.ten}`;
                      return (
                        <label key={key} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={Boolean(pickedTens[key])}
                            onChange={(e) =>
                              setPickedTens((prev) => ({ ...prev, [key]: e.target.checked }))
                            }
                          />
                          <span>{n.display}</span>
                        </label>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex gap-2">
              <Button className="flex-1" type="button" onClick={confirmPickedNumbers}>
                {t("importSelected")}
              </Button>
              <Button type="button" variant="outline" onClick={() => setMultiPick([])}>
                {t("cancel")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

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
          const found = ten.length === 10 ? vendorForPhone(c.phone) : undefined;
          const trade = found?.industry && found.shop && !/^Shop \d{10}$/.test(found.shop) ? found.industry : undefined;
          const v =
            ten.length === 10 && ten !== meTen
              ? {
                  id: found?.id || `u-vaani-${ten}`,
                  name: (found?.shop || found?.name || c.name || "").trim() || `Shop ${ten}`,
                  shop: (found?.shop || "").trim() || `Shop ${ten}`,
                  phone: formatInPhone(ten),
                  city: "",
                  industry: trade || found?.industry || "pharmaceutical",
                  catalog: found?.catalog || [],
                  altPhones: [ten],
                }
              : undefined;
          return (
            <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{c.name}</p>
                <p className="truncate text-xs text-muted">
                  {c.phone}
                  {ten.length === 10 && ten !== meTen
                    ? ` · ${tradeLabel(trade || (found?.industry && found.industry !== "grocery" ? found.industry : "pharmaceutical"))}`
                    : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
              {ten.length === 10 && ten !== meTen ? (
                <ReminderButton contactName={c.name} contactPhone={c.phone} notifyBoth={false} />
              ) : null}
              {ten === meTen ? (
                <span className="text-xs text-subtle">{t("yourShop")}</span>
              ) : v ? (
                <Button
                  type="button"
                  size="sm"
                  className="h-9 rounded-full px-3"
                  onClick={() => {
                    const ten = readLoginTen();
                    if (ten.length === 10) rememberLoginTen(ten);
                    keepSession();
                    const live = useVaani.getState().liveVendors;
                    if (!live.some((row) => row.id === v.id)) {
                      setLiveVendors([...live, v]);
                    }
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
              </div>
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
                        const byPhone = row.vendorPhone ? vendorForPhone(row.vendorPhone) : undefined;
                        const vend = byPhone || vendorById(row.vendorId);
                        const vTen = (row.vendorPhone || vend?.phone || "").replace(/\D/g, "").slice(-10);
                        const book = contacts.find((c) => phoneDigits(c.phone) === vTen)?.name.trim();
                        const title = book || (row.vendorShop || "").trim() || vend?.shop || `Shop ${vTen || ""}`;
                        const phone = vend?.phone || row.vendorPhone || "";
                        return (
                          <li key={row.id} className="flex items-center gap-2">
                            <Link
                              to="/ticket/$ticketId"
                              params={{ ticketId: row.id }}
                              className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-line bg-surface px-4 py-4"
                              onClick={() => void navigate({ to: "/ticket/$ticketId", params: { ticketId: row.id } })}
                            >
                             <div className="min-w-0">
                                <p className="truncate font-medium">{title}</p>
                                <p className="truncate text-xs text-muted">
                                  {t("linesCount", { n: row.lines.length })}
                                  {phone ? ` · ${phone}` : ""}
                                  {" · "}
                                  {new Date(row.createdAt).toLocaleString(locale)}
                                </p>
                              </div>
                              <StatusPill status={row.status} />
                            </Link>
                            {row.status === "draft" ? (
                              <button
                                type="button"
                                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-danger"
                                aria-label={t("deleteDraft")}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  removeTicket(row.id);
                                }}
                              >
                                <Trash2 className="size-4" />
                              </button>
                            ) : null}
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
