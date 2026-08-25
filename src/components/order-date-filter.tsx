import type { Ticket } from "@/lib/vaani/types";
import { useT, type UiKey } from "@/lib/vaani/i18n";

export type DatePreset = "all" | "today" | "yesterday" | "week" | "month" | "custom";

export type DateFilter = {
  preset: DatePreset;
  from: string;
  to: string;
};

export const DEFAULT_DATE_FILTER: DateFilter = { preset: "all", from: "", to: "" };

const PRESETS: { id: DatePreset; key: UiKey }[] = [
  { id: "all", key: "all" },
  { id: "today", key: "today" },
  { id: "yesterday", key: "yesterday" },
  { id: "week", key: "thisWeek" },
  { id: "month", key: "thisMonth" },
  { id: "custom", key: "custom" },
];

export function dayKey(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shiftDay(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function mondayOf(d: Date) {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function monthStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function presetRange(preset: DatePreset, from: string, to: string): { from: string; to: string } | null {
  const now = new Date();
  if (preset === "all") return null;
  if (preset === "today") {
    const k = dayKey(now.toISOString());
    return { from: k, to: k };
  }
  if (preset === "yesterday") {
    const k = dayKey(shiftDay(now, -1).toISOString());
    return { from: k, to: k };
  }
  if (preset === "week") {
    return { from: dayKey(mondayOf(now).toISOString()), to: dayKey(now.toISOString()) };
  }
  if (preset === "month") {
    return { from: dayKey(monthStart(now).toISOString()), to: dayKey(now.toISOString()) };
  }
  if (!from && !to) return null;
  return { from: from || to, to: to || from };
}

export function filterByDate(tickets: Ticket[], filter: DateFilter) {
  const range = presetRange(filter.preset, filter.from, filter.to);
  if (!range) return tickets;
  return tickets.filter((t) => {
    const k = dayKey(t.createdAt);
    return k >= range.from && k <= range.to;
  });
}

export function groupByDate(tickets: Ticket[], todayLabel = "Today", yesterdayLabel = "Yesterday", locale = "en-IN") {
  const today = dayKey(new Date().toISOString());
  const yesterday = dayKey(shiftDay(new Date(), -1).toISOString());
  const groups = new Map<string, Ticket[]>();
  for (const t of tickets) {
    const k = dayKey(t.createdAt);
    const list = groups.get(k) ?? [];
    list.push(t);
    groups.set(k, list);
  }
  return [...groups.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, rows]) => ({
      key,
      label:
        key === today
          ? todayLabel
          : key === yesterday
            ? yesterdayLabel
            : new Date(`${key}T12:00:00`).toLocaleDateString(locale, {
                day: "numeric",
                month: "short",
                year: "numeric",
              }),
      tickets: rows,
    }));
}

export function OrderDateFilter({
  value,
  onChange,
}: {
  value: DateFilter;
  onChange: (next: DateFilter) => void;
}) {
  const { t } = useT();
  return (
    <div className="mb-3 space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange({ ...value, preset: p.id })}
            className={`h-8 rounded-full border px-3 text-xs font-medium ${
              value.preset === p.id
                ? "border-accent bg-accent text-accent-fg"
                : "border-line bg-surface text-muted"
            }`}
          >
            {t(p.key)}
          </button>
        ))}
      </div>
      {value.preset === "custom" ? (
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-muted">{t("from")}</label>
          <input
            type="date"
            value={value.from}
            onChange={(e) => onChange({ ...value, from: e.target.value, preset: "custom" })}
            className="h-9 rounded-[var(--radius-sm)] border border-line bg-surface px-2 text-sm"
          />
          <label className="text-xs text-muted">{t("to")}</label>
          <input
            type="date"
            value={value.to}
            onChange={(e) => onChange({ ...value, to: e.target.value, preset: "custom" })}
            className="h-9 rounded-[var(--radius-sm)] border border-line bg-surface px-2 text-sm"
          />
        </div>
      ) : null}
    </div>
  );
}
