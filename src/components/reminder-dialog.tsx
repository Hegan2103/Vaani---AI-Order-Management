import { useState } from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteReminderRemote, fireReminderPush, saveReminder } from "@/lib/vaani/account";
import { useT } from "@/lib/vaani/i18n";
import {
  WEEKDAYS,
  blankReminder,
  deleteReminder,
  listReminders,
  reminderTargets,
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
  const existing = listReminders().find((r) => r.ownerTen === ownerTen && r.contactTen === contactTen);
  const [row, setRow] = useState<Reminder>(
    existing || blankReminder(ownerTen, contactTen, contactName, notifyBoth),
  );
  const [msg, setMsg] = useState<string | null>(null);

  function patch(part: Partial<Reminder>) {
    setRow((r) => ({ ...r, ...part, notifyBoth }));
  }

  async function save() {
    const next = {
      ...row,
      id: crypto.randomUUID(),
      notifyBoth,
      contactName,
      ownerTen,
      contactTen,
      lastFired: "",
      bells: {},
    };
    upsertReminder(next);
    try {
      await saveReminder({ data: { reminder: next } });
    } catch {
      /* local copy kept */
    }
    const [hh, mm] = String(next.time || "09:00").split(":").map((n) => Number(n));
    const when = new Date();
    when.setHours(hh || 0, mm || 0, 0, 0);
    const wait = when.getTime() - Date.now();
    if (wait > 2000) {
      window.setTimeout(() => {
        const stamp = new Date().toISOString().slice(0, 10);
        const fired = { ...next, lastFired: stamp };
        upsertReminder(fired);
        void saveReminder({ data: { reminder: fired } }).catch(() => undefined);
        const phones = reminderTargets(fired);
        if (phones.length) {
          void fireReminderPush({
            data: {
              phones,
              title: contactName || "Reminder",
              body: fired.message || contactName || "Reminder",
            },
          }).catch(() => undefined);
        }
      }, wait);
    }
    setMsg(t("reminderSaved"));
  }

  async function remove() {
    deleteReminder(row.id);
    try {
      await deleteReminderRemote({ data: { id: row.id } });
    } catch {
      /* local copy removed */
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-end bg-ink/40 p-4 sm:place-items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-[var(--radius-xl)] border border-line bg-surface p-5"
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
        />

        {row.repeat === "weekly" ? (
          <>
            <label className="mt-3 block text-xs text-muted">{t("reminderDay")}</label>
            <select
              className="mt-1 h-11 w-full rounded-[var(--radius-md)] border border-line bg-bg px-3 text-sm"
              value={row.weekday}
              onChange={(e) => patch({ weekday: Number(e.target.value) })}
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
              />
            </div>
            <div>
              <label className="block text-xs text-muted">{t("reminderTo")}</label>
              <input
                type="date"
                className="mt-1 h-11 w-full rounded-[var(--radius-md)] border border-line bg-bg px-3 text-sm"
                value={row.to}
                onChange={(e) => patch({ to: e.target.value })}
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
        />

        {msg ? <p className="mt-2 text-sm text-ok">{msg}</p> : null}
        <div className="mt-4 flex gap-2">
          <Button type="button" className="flex-1" onClick={() => void save()}>
            {t("saveShop")}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
        </div>
        {existing ? (
          <button type="button" className="mt-3 text-xs text-danger" onClick={() => void remove()}>
            {t("deleteDraft")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
