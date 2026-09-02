import { phoneDigits } from "./seed";
import type { Reminder, ReminderRepeat } from "./types";

const KEY = "vaani-reminders-v1";

function loadAll(): Reminder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY) || sessionStorage.getItem(KEY) || "[]";
    const rows = JSON.parse(raw) as Reminder[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function saveAll(rows: Reminder[]) {
  if (typeof window === "undefined") return;
  const raw = JSON.stringify(rows);
  localStorage.setItem(KEY, raw);
  sessionStorage.setItem(KEY, raw);
}

export function listReminders(): Reminder[] {
  return loadAll();
}

export function upsertReminder(row: Reminder) {
  const all = loadAll().filter((r) => r.id !== row.id);
  all.push(row);
  saveAll(all);
}

export function deleteReminder(id: string) {
  saveAll(loadAll().filter((r) => r.id !== id));
}

export function mergeReminders(extra: Reminder[]) {
  const map = new Map(loadAll().map((r) => [r.id, r]));
  for (const r of extra) {
    const prev = map.get(r.id);
    if (!prev) {
      map.set(r.id, r);
      continue;
    }
    const newer = (r.lastFired || "") > (prev.lastFired || "") ? r : prev;
    const older = newer === r ? prev : r;
    map.set(r.id, { ...newer, bells: { ...(older.bells || {}), ...(newer.bells || {}) } });
  }
  saveAll([...map.values()]);
}

function todayStamp(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function minutesNow(d = new Date()) {
  return d.getHours() * 60 + d.getMinutes();
}

function parseTime(hhmm: string) {
  const [h, m] = (hhmm || "09:00").split(":").map((n) => Number(n));
  return (h || 0) * 60 + (m || 0);
}

export function isReminderDue(row: Reminder, now = new Date()): boolean {
  const today = todayStamp(now);
  if (row.lastFired === today) return false;
  if (minutesNow(now) < parseTime(row.time)) return false;
  if (row.repeat === "daily") return true;
  if (row.repeat === "weekly") return now.getDay() === (row.weekday ?? 1);
  if (row.repeat === "once") return (row.date || "") === today;
  if (row.repeat === "range") {
    const from = row.from || today;
    const to = row.to || today;
    return today >= from && today <= to;
  }
  return false;
}

export function markFired(id: string) {
  const all = loadAll().map((r) => (r.id === id ? { ...r, lastFired: todayStamp() } : r));
  saveAll(all);
}

export function reminderTargets(row: Reminder): string[] {
  const owner = phoneDigits(row.ownerTen);
  const other = phoneDigits(row.contactTen);
  if (row.notifyBoth) {
    return [...new Set([owner, other].filter((t) => t.length === 10))];
  }
  return other.length === 10 && other !== owner ? [other] : [];
}

export function reminderNeedsBell(row: Reminder, me: string): boolean {
  const ten = phoneDigits(me);
  if (ten.length !== 10 || !reminderTargets(row).includes(ten)) return false;
  const today = todayStamp();
  if ((row.lastFired || "") !== today) return false;
  return (row.bells || {})[ten] !== today;
}

export function markBellSeen(id: string, ten: string) {
  const all = loadAll().map((r) => {
    if (r.id !== id) return r;
    return { ...r, bells: { ...(r.bells || {}), [phoneDigits(ten)]: todayStamp() } };
  });
  saveAll(all);
}

export function blankReminder(
  ownerTen: string,
  contactTen: string,
  contactName: string,
  notifyBoth: boolean,
): Reminder {
  return {
    id: crypto.randomUUID(),
    ownerTen,
    contactTen,
    contactName,
    message: "",
    repeat: "daily",
    time: "09:00",
    weekday: 1,
    date: todayStamp(),
    from: todayStamp(),
    to: todayStamp(),
    notifyBoth,
    lastFired: "",
    createdAt: new Date().toISOString(),
  };
}

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function repeatLabel(repeat: ReminderRepeat) {
  return repeat;
}
