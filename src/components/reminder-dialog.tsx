import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteReminderRemote, listRemindersRemote, saveReminder } from "@/lib/vaani/account";
import { useT } from "@/lib/vaani/i18n";
import {
  WEEKDAYS,
  blankReminder,
  deleteReminder,
  listReminders,
  mergeReminders,
  upsertReminder,
} from "@/lib/vaani/reminders";
import { formatInPhone, phoneDigits } from "@/lib/vaani/seed";
import { liveLoginTen, readLoginTen } from "@/lib/vaani/store";
import type { Reminder, ReminderRepeat } from "@/lib/vaani/types";

export function ReminderButton({
  contactName,
  contactPhone,
  notifyBoth,
}: {
  contactName: string;
  contactPhone: string;
  notifyBoth: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { t } = useT();
  return (
    <>
      <button
        type="button"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-sm"
        aria-label={t("setReminder")}
        onClick={() => setOpen(true)}
      >
        <Clock className="size-4" />
      </button>
      {open ? (
        <ReminderForm
          contactName={contactName}
          contactPhone={contactPhone}
          notifyBoth={notifyBoth}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function ReminderForm({
  contactName,
  contactPhone,
  notifyBoth,
  onClose,
}: {
  contactName: string;
  contactPhone: string;
  notifyBoth: boolean;
  onClose: () => void;
}) {
  const { t } = useT();
  const ownerTen = liveLoginTen() || readLoginTen();
  const contactTen = phoneDigits(contactPhone);
  function formKey() {
    return `vaani-reminder-form:${phoneDigits(ownerTen)}:${phoneDigits(contactTen)}`;
  }
  function readFormCache(): Reminder | undefined {
    if (typeof window === "undefined" || ownerTen.length !== 10 || contactTen.length !== 10) return undefined;
    try {
      const raw = localStorage.getItem(formKey());
      if (!raw) return undefined;
      const parsed = JSON.parse(raw) as Reminder;
      if (!parsed || typeof parsed !== "object") return undefined;
      return parsed;
    } catch {
      return undefined;
    }
  }
  function latestForPair() {
    const cached = readFormCache();
    const listed = listReminders()
      .filter((r) => phoneDigits(r.ownerTen) === ownerTen && phoneDigits(r.contactTen) === contactTen)
      .sort((a, b) => String(b.createdAt || b.time || "").localeCompare(String(a.createdAt || a.time || "")));
    return cached || listed[0];
  }
  const existing = latestForPair();
  const [row, setRow] = useState<Reminder>(
    existing || blankReminder(ownerTen, contactTen, contactName, notifyBoth),
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [hasSaved, setHasSaved] = useState(Boolean(existing?.message || existing?.time));

  useEffect(() => {
    let stop = false;
    void listRemindersRemote({ data: { phone: ownerTen } })
      .then((remote) => {
        if (stop) return;
        const rows = Array.isArray(remote) ? remote : [];
        if (rows.length) mergeReminders(rows as Reminder[]);
        const cached = readFormCache();
        if (cached && (cached.time || cached.message)) {
          setHasSaved(true);
          setRow({
            ...blankReminder(ownerTen, contactTen, contactName, notifyBoth),
            ...cached,
            notifyBoth,
            contactName,
            ownerTen,
            contactTen,
            time: String(cached.time || "09:00").slice(0, 5),
            message: String(cached.message || ""),
          });
          return;
        }
        const hit = latestForPair();
        if (hit) {
          setHasSaved(true);
          setRow({
            ...blankReminder(ownerTen, contactTen, contactName, notifyBoth),
            ...hit,
            notifyBoth,
            contactName,
            ownerTen,
            contactTen,
            time: String(hit.time || "09:00").slice(0, 5),
            message: String(hit.message || ""),
          });
        }
      })
      .catch(() => undefined);
    return () => {
      stop = true;
    };
  }, [ownerTen, contactTen]);

  function patch(part: Partial<Reminder>) {
    setRow((r) => ({ ...r, ...part, notifyBoth }));
  }

  async function save() {
    if (saving) return;
    flushSync(() => {
      setSaving(true);
      setBusy("save");
      setMsg(null);
    });
    const next = {
      ...row,
      id: crypto.randomUUID(),
      notifyBoth,
      contactName,
      ownerTen,
      contactTen,
      createdAt: new Date().toISOString(),
      lastFired: "",
      bells: {},
    };
    for (const old of listReminders().filter(
      (r) => r.id !== next.id && phoneDigits(r.ownerTen) === ownerTen && phoneDigits(r.contactTen) === contactTen,
    )) {
      deleteReminder(old.id);
      void deleteReminderRemote({ data: { id: old.id } }).catch(() => undefined);
    }
    upsertReminder(next);
    try {
      localStorage.setItem(formKey(), JSON.stringify(next));
    } catch {
      /* ignore */
    }
    try {
      await saveReminder({ data: { reminder: next } });
    } catch {
      /* local copy kept */
    }
    setMsg(t("reminderSaved"));
    setHasSaved(true);
    setSaving(false);
    setBusy(null);
  }

  async function remove() {
    if (saving) return;
    flushSync(() => {
      setSaving(true);
      setBusy("delete");
      setMsg(null);
    });
    const ids = new Set<string>();
    if (row.id) ids.add(row.id);
    try {
      const cached = readFormCache();
      if (cached?.id) ids.add(cached.id);
    } catch {
      /* ignore */
    }
    for (const old of listReminders().filter(
      (r) => phoneDigits(r.ownerTen) === ownerTen && phoneDigits(r.contactTen) === contactTen,
    )) {
      ids.add(old.id);
    }
    try {
      const remote = await listRemindersRemote({ data: { phone: ownerTen } });
      const rows = Array.isArray(remote) ? remote : [];
      for (const r of rows as Reminder[]) {
        if (phoneDigits(r.ownerTen) === ownerTen && phoneDigits(r.contactTen) === contactTen && r.id) ids.add(r.id);
      }
    } catch {
      /* local ids only */
    }
    for (const id of ids) {
      deleteReminder(id);
      try {
        await deleteReminderRemote({ data: { id } });
      } catch {
        /* keep going */
      }
    }
    try {
      localStorage.removeItem(formKey());
    } catch {
      /* ignore */
    }
    setRow(blankReminder(ownerTen, contactTen, contactName, notifyBoth));
    setHasSaved(false);
    setMsg(null);
    setSaving(false);
    setBusy(null);
  }

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-end bg-ink/40 p-4 sm:place-items-center"
      onClick={() => {
        if (!saving) onClose();
      }}
    >
      {saving ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50">
          <div className="flex flex-col items-center gap-3 rounded-[var(--radius-xl)] border border-line bg-surface px-8 py-6">
            <Loader2 className="size-8 animate-spin text-accent" />
            <p className="text-sm font-medium">{busy === "delete" ? "Deleting…" : t("saving")}</p>
            <p className="text-xs text-muted">{t("pleaseWait")}</p>
          </div>
        </div>
      ) : null}
      <div
        className="relative w-full max-w-md rounded-[var(--radius-xl)] border border-line bg-surface p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{t("setReminder")}</p>
        <p className="mt-1 font-medium">
          {contactName} · {formatInPhone(contactTen)}
        </p>
        <p className="mt-1 text-xs text-muted">{notifyBoth ? t("reminderBothHint") : t("reminderSelfHint")}</p>

        <label className="mt-4 block text-xs text-muted">{t("reminderRepeat")}</label>
        <select
          className="mt-1 h-11 w-full rounded-[var(--radius-md)] border border-line bg-bg px-3 text-sm"
          value={row.repeat}
          onChange={(e) => patch({ repeat: e.target.value as ReminderRepeat })}
          disabled={saving}
        >
          <option value="daily">{t("reminderDaily")}</option>
          <option value="weekly">{t("reminderWeekly")}</option>
          <option value="once">{t("reminderOnce")}</option>
          <option value="range">{t("reminderRange")}</option>
        </select>

        <label className="mt-3 block text-xs text-muted">{t("reminderTime")}</label>
        <input
          type="time"
          className="mt-1 h-11 w-full rounded-[var(--radius-md)] border border-line bg-bg px-3 text-sm"
          value={row.time}
          onChange={(e) => patch({ time: e.target.value })}
          disabled={saving}
        />

        {row.repeat === "weekly" ? (
          <>
            <label className="mt-3 block text-xs text-muted">{t("reminderDay")}</label>
            <select
              className="mt-1 h-11 w-full rounded-[var(--radius-md)] border border-line bg-bg px-3 text-sm"
              value={row.weekday}
              onChange={(e) => patch({ weekday: Number(e.target.value) })}
              disabled={saving}
            >
              {WEEKDAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </>
        ) : null}

        {row.repeat === "once" ? (
          <>
            <label className="mt-3 block text-xs text-muted">{t("reminderOnce")}</label>
            <input
              type="date"
              className="mt-1 h-11 w-full rounded-[var(--radius-md)] border border-line bg-bg px-3 text-sm"
              value={row.date}
              onChange={(e) => patch({ date: e.target.value })}
              disabled={saving}
            />
          </>
        ) : null}

        {row.repeat === "range" ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-muted">{t("reminderFrom")}</label>
              <input
                type="date"
                className="mt-1 h-11 w-full rounded-[var(--radius-md)] border border-line bg-bg px-3 text-sm"
                value={row.from}
                onChange={(e) => patch({ from: e.target.value })}
                disabled={saving}
              />
            </div>
            <div>
              <label className="block text-xs text-muted">{t("reminderTo")}</label>
              <input
                type="date"
                className="mt-1 h-11 w-full rounded-[var(--radius-md)] border border-line bg-bg px-3 text-sm"
                value={row.to}
                onChange={(e) => patch({ to: e.target.value })}
                disabled={saving}
              />
            </div>
          </div>
        ) : null}

        <label className="mt-3 block text-xs text-muted">{t("reminderMessage")}</label>
        <textarea
          rows={3}
          className="mt-1 w-full rounded-[var(--radius-md)] border border-line bg-bg p-3 text-sm"
          value={row.message}
          onChange={(e) => patch({ message: e.target.value })}
          placeholder={t("reminderMessage")}
          disabled={saving}
        />

        {msg ? <p className="mt-2 text-sm text-ok">{msg}</p> : null}
        <div className="mt-4 flex gap-2">
          <Button type="button" className="flex-1" onClick={() => void save()} disabled={saving}>
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                {t("saving")}
              </span>
            ) : (
              t("reminderSave")
            )}
          </Button>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            {t("cancel")}
          </Button>
        </div>
        {hasSaved ? (
          <button type="button" className="mt-3 text-xs text-danger" onClick={() => void remove()} disabled={saving}>
            {t("deleteDraft")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
