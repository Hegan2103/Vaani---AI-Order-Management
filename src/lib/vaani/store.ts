import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { DEFAULT_CONTACTS, formatInPhone, inboxIdForUser, phoneDigits, phonesMatch, VENDORS } from "./seed";
import type { Contact, Industry, LineItem, Role, Ticket, TicketStatus, VaaniNotice, Vendor } from "./types";

const LAST_TICKET_KEY = "vaani-last-ticket";
const SHOP_KEY = "vaani-shop-identity-v1";
const BACKUP_KEY = "vaani-account-backup-v1";
const LOGIN_PHONE_KEY = "vaani-login-phone";
const DIR_KEY = "vaani-dir-contacts";
const DIR_FLAG = "vaani-dir-pulled";
const BOOK_KEY = "vaani-phonebook-names";
const LISTED_KEY = "vaani-listed-vendors-v1";
const LANG_KEY = "vaani-ui-language";

export function purgeStaleClientCache() {
  return false;
}

export function readUiLanguage() {
  if (typeof window === "undefined") return "en-IN";
  try {
    const direct = localStorage.getItem(LANG_KEY) || sessionStorage.getItem(LANG_KEY);
    if (direct) return direct;
  } catch {
    /* ignore */
  }
  try {
    const raw = localStorage.getItem("vaani-store-v3");
    if (raw) {
      const parsed = JSON.parse(raw) as { state?: { language?: string } };
      if (parsed?.state?.language) return parsed.state.language;
    }
  } catch {
    /* ignore */
  }
  try {
    const shopRaw = localStorage.getItem(SHOP_KEY) || sessionStorage.getItem(SHOP_KEY);
    if (shopRaw) {
      const shop = JSON.parse(shopRaw) as ShopIdentity;
      if (shop.language) return shop.language;
    }
  } catch {
    /* ignore */
  }
  return "en-IN";
}

export function writeUiLanguage(lang: string) {
  if (typeof window === "undefined" || !lang) return;
  try {
    localStorage.setItem(LANG_KEY, lang);
    sessionStorage.setItem(LANG_KEY, lang);
  } catch {
    /* ignore */
  }
}

export type ShopIdentity = {
  shopName: string;
  phone: string;
  industry: Industry | "";
  isVendor: boolean;
  language: string;
};

export function loginPhoneKey() {
  return LOGIN_PHONE_KEY;
}

export function writeDirContacts(rows: Contact[]) {
  if (typeof window === "undefined") return;
  const raw = JSON.stringify(rows);
  try {
    sessionStorage.setItem(DIR_FLAG, "1");
    sessionStorage.setItem(DIR_KEY, raw);
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(DIR_FLAG, "1");
    localStorage.setItem(DIR_KEY, raw);
  } catch {
    /* ignore */
  }
  const names = readBookNames();
  for (const c of rows) {
    const ten = phoneDigits(c.phone);
    const label = (c.name || "").trim();
    if (ten.length === 10 && label && !isShopFallbackName(label, ten)) names[ten] = label;
  }
  writeBookNames(names);
  useVaani.setState({ contacts: rows });
}

export function readBookNames(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(BOOK_KEY) || sessionStorage.getItem(BOOK_KEY) || "{}";
    const rows = JSON.parse(raw) as Record<string, string>;
    return rows && typeof rows === "object" ? rows : {};
  } catch {
    return {};
  }
}

function writeBookNames(names: Record<string, string>) {
  if (typeof window === "undefined") return;
  const raw = JSON.stringify(names);
  try {
    localStorage.setItem(BOOK_KEY, raw);
    sessionStorage.setItem(BOOK_KEY, raw);
  } catch {
    /* ignore */
  }
}

export function bookNameFor(phone: string, fallback = "") {
  const ten = phoneDigits(phone);
  if (ten.length !== 10) return fallback;
  const label = (readBookNames()[ten] || "").trim();
  return label || fallback;
}

function isShopFallbackName(label: string, ten: string) {
  const n = (label || "").trim();
  if (!n) return true;
  return n === `Shop ${ten}` || /^Shop\s*\d{10}$/i.test(n);
}

export function directoryRows(meTen = ""): Contact[] {
  if (typeof window === "undefined") return [];
  const me = phoneDigits(meTen);
  const names = readBookNames();
  const map = new Map<string, Contact>();
  const ingest = (c: { id?: string; name?: string; phone?: string; vendorId?: string; source?: Contact["source"] }) => {
    const ten = phoneDigits(c.phone || "");
    if (ten.length !== 10 || ten === me) return;
    const book = (names[ten] || "").trim();
    const raw = (c.name || "").trim();
    if (!book && raw && c.source === "phone" && !isShopFallbackName(raw, ten)) {
      names[ten] = raw;
    }
    const label = (names[ten] || "").trim() || raw;
    if (!label) return;
    const prev = map.get(ten);
    map.set(ten, {
      id: prev?.id || c.id || `book-${ten}`,
      name: (names[ten] || "").trim() || prev?.name || label,
      phone: formatInPhone(ten),
      vendorId: c.vendorId || prev?.vendorId,
      source: names[ten] ? "phone" : c.source || prev?.source || "vaani",
    });
  };
  for (const c of readDirContacts() || []) ingest(c);
  try {
    for (const c of useVaani.getState().contacts) ingest(c);
  } catch {
    /* store not ready */
  }
  for (const [ten, name] of Object.entries(names)) ingest({ id: `book-${ten}`, name, phone: ten, source: "phone" });
  writeBookNames(names);
  return [...map.values()];
}

export function readDirContacts(): Contact[] | null {
  if (typeof window === "undefined") return null;
  try {
    const flag = sessionStorage.getItem(DIR_FLAG) || localStorage.getItem(DIR_FLAG);
    const raw = sessionStorage.getItem(DIR_KEY) || localStorage.getItem(DIR_KEY);
    if (flag !== "1" && !raw) return null;
    if (!raw) return [];
    const rows = JSON.parse(raw) as Contact[];
    if (!Array.isArray(rows)) return [];
    const names = readBookNames();
    let added = false;
    for (const c of rows) {
      const ten = phoneDigits(c.phone);
      const label = (c.name || "").trim();
      if (ten.length === 10 && label && !isShopFallbackName(label, ten) && (c.source === "phone" || !names[ten])) {
        names[ten] = label;
        added = true;
      }
    }
    if (added) writeBookNames(names);
    return rows;
  } catch {
    return null;
  }
}

export function applyDirContacts() {
  const rows = directoryRows(readLoginTen());
  if (!rows.length) return false;
  useVaani.setState({ contacts: rows });
  return true;
}

export function rememberLoginTen(phone: string) {
  if (typeof window === "undefined") return;
  const ten = phoneDigits(phone);
  if (ten.length !== 10) return;
  try {
    sessionStorage.setItem(LOGIN_PHONE_KEY, ten);
    localStorage.setItem(LOGIN_PHONE_KEY, ten);
    const known = JSON.parse(localStorage.getItem("vaani-known-phones") || "[]") as string[];
    if (!known.includes(ten)) {
      known.push(ten);
      localStorage.setItem("vaani-known-phones", JSON.stringify(known));
    }
  } catch {
    /* ignore */
  }
  try {
    document.cookie = `vaani_phone=${ten}; path=/; max-age=2592000; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

export function readLoginTen() {
  if (typeof window === "undefined") return "";
  try {
    if (sessionStorage.getItem("vaani-signed-out") === "1" || localStorage.getItem("vaani-signed-out") === "1") return "";
  } catch {
    /* ignore */
  }
  const tryTen = (raw: string) => {
    const t = phoneDigits(String(raw || ""));
    return t.length === 10 ? t : "";
  };
  try {
    const q = tryTen(new URLSearchParams(window.location.search).get("v") || "");
    if (q) return q;
  } catch {
    /* ignore */
  }
  try {
    const t = tryTen(sessionStorage.getItem(LOGIN_PHONE_KEY) || localStorage.getItem(LOGIN_PHONE_KEY) || "");
    if (t) return t;
  } catch {
    /* ignore */
  }
  try {
    const m = document.cookie.match(/(?:^|; )vaani_phone=(\d{10})(?:;|$)/);
    if (m?.[1]) return m[1];
  } catch {
    /* ignore */
  }
  return "";
}

export function liveLoginTen() {
  if (typeof window === "undefined") return "";
  try {
    if (sessionStorage.getItem("vaani-signed-out") === "1" || localStorage.getItem("vaani-signed-out") === "1") return "";
  } catch {
    /* ignore */
  }
  try {
    const attr = phoneDigits(document.documentElement.getAttribute("data-vaani-phone") || "");
    if (attr.length === 10) return attr;
  } catch {
    /* ignore */
  }
  return readLoginTen();
}

export function tenFromEmail(email?: string | null) {
  return (email ?? "").match(/^91(\d{10})@/i)?.[1] ?? "";
}

export type AccountBackup = {
  shopName: string;
  phone: string;
  industry: Industry | "";
  isVendor: boolean;
  language: string;
  claimedVendorId: string;
  tickets: Ticket[];
  incoming: Ticket[];
};

export function writeAccountBackup() {
  if (typeof window === "undefined") return;
  try {
    const s = useVaani.getState();
    const ten = phoneDigits(s.customerPhone) || readLoginTen();
    if (!s.customerName.trim() && !s.tickets.length && !s.incoming.length) return;
    const payload: AccountBackup = {
      shopName: s.customerName,
      phone: s.customerPhone,
      industry: s.industry,
      isVendor: s.isVendor,
      language: s.language,
      claimedVendorId: s.claimedVendorId,
      tickets: s.tickets,
      incoming: s.incoming,
    };
    const all = JSON.parse(localStorage.getItem(BACKUP_KEY) || "{}") as Record<string, AccountBackup>;
    if (ten.length === 10) {
      const prev = all[ten];
      if (prev) {
        if (!payload.tickets.length && prev.tickets?.length) payload.tickets = prev.tickets;
        if (!payload.incoming.length && prev.incoming?.length) payload.incoming = prev.incoming;
        if (!payload.shopName.trim() && prev.shopName) {
          payload.shopName = prev.shopName;
          payload.industry = payload.industry || prev.industry;
          payload.isVendor = payload.isVendor || prev.isVendor;
        }
      }
      all[ten] = payload;
    }
    if (s.accountUserId) all[`user:${s.accountUserId}`] = payload;
    localStorage.setItem(BACKUP_KEY, JSON.stringify(all));
    sessionStorage.setItem(BACKUP_KEY, JSON.stringify(all));
    if (ten.length === 10) {
      const ticketDump = JSON.stringify({ tickets: payload.tickets, incoming: payload.incoming });
      localStorage.setItem(`vaani-tickets-v1:${ten}`, ticketDump);
      sessionStorage.setItem(`vaani-tickets-v1:${ten}`, ticketDump);
    }
  } catch {
    /* ignore */
  }
}

export function readAccountBackup(ten?: string, userId?: string): AccountBackup | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(BACKUP_KEY) || sessionStorage.getItem(BACKUP_KEY) || "{}";
    const all = JSON.parse(raw) as Record<string, AccountBackup>;
    if (ten && all[ten]?.shopName) return all[ten];
    if (ten && all[ten]) return all[ten];
    if (userId && all[`user:${userId}`]) return all[`user:${userId}`];
    const values = Object.values(all);
    return values.find((v) => v.shopName?.trim() || v.tickets?.length) ?? null;
  } catch {
    return null;
  }
}

export function readPersistedShop(): ShopIdentity | null {
  if (typeof window === "undefined") return null;
  try {
    const store = JSON.parse(localStorage.getItem("vaani-store-v3") || "{}") as {
      state?: { customerName?: string; customerPhone?: string; industry?: string; isVendor?: boolean; language?: string };
    };
    const s = store.state ?? {};
    if (!String(s.customerName || "").trim()) return null;
    return {
      shopName: String(s.customerName).trim(),
      phone: String(s.customerPhone || ""),
      industry: (s.industry as ShopIdentity["industry"]) || "",
      isVendor: Boolean(s.isVendor),
      language: s.language || "en-IN",
    };
  } catch {
    return null;
  }
}

export function readShopIdentity(phone?: string): ShopIdentity | null {
  if (typeof window === "undefined") return null;
  const ten = phoneDigits(phone || liveLoginTen() || readLoginTen());
  if (ten.length !== 10) return null;
  try {
    const keyed = localStorage.getItem(`${SHOP_KEY}:${ten}`) || sessionStorage.getItem(`${SHOP_KEY}:${ten}`);
    if (!keyed) return null;
    const p = JSON.parse(keyed) as ShopIdentity;
    if (!p?.shopName?.trim()) return null;
    const storedTen = phoneDigits(p.phone);
    if (storedTen.length === 10 && storedTen !== ten) return null;
    return { ...p, phone: formatInPhone(ten) };
  } catch {
    return null;
  }
}function writeShopCookies(p: ShopIdentity) {
  if (typeof document === "undefined") return;
  const max = "path=/; max-age=2592000; SameSite=Lax";
  try {
    document.cookie = `vaani_shop=${encodeURIComponent(p.shopName.trim())}; ${max}`;
    document.cookie = `vaani_industry=${encodeURIComponent(p.industry || "")}; ${max}`;
    document.cookie = `vaani_isvendor=${p.isVendor ? "1" : "0"}; ${max}`;
    document.cookie = `vaani_lang=${encodeURIComponent(p.language || "en-IN")}; ${max}`;
    document.cookie = `vaani_id=${encodeURIComponent(
      JSON.stringify({
        shopName: p.shopName.trim(),
        phone: p.phone,
        industry: p.industry || "",
        isVendor: p.isVendor,
        language: p.language || "en-IN",
      }),
    )}; ${max}`;
  } catch {
    /* ignore */
  }
}

export function queueProfileSave(_p: ShopIdentity) {}

function readShopCookies(): ShopIdentity | null {
  if (typeof document === "undefined") return null;
  try {
    const grab = (key: string) => {
      const m = document.cookie.match(new RegExp(`(?:^|; )${key}=([^;]*)`));
      return m ? decodeURIComponent(m[1]) : "";
    };
    const shopName = grab("vaani_shop").trim();
    if (!shopName) {
      const packed = grab("vaani_id");
      if (packed) {
        try {
          const p = JSON.parse(packed) as ShopIdentity;
          if (p.shopName?.trim()) return { ...p, phone: p.phone || formatInPhone(liveLoginTen() || readLoginTen()) };
        } catch {
          /* ignore */
        }
      }
      return null;
    }
    return {
      shopName,
      phone: formatInPhone(liveLoginTen() || readLoginTen()),
      industry: (grab("vaani_industry") as ShopIdentity["industry"]) || "",
      isVendor: grab("vaani_isvendor") === "1",
      language: grab("vaani_lang") || "en-IN",
    };
  } catch {
    return null;
  }
}

export function writeShopIdentity(p: ShopIdentity) {
  if (typeof window === "undefined") return;
  if (!p.shopName?.trim()) return;
  try {
    const ten = liveLoginTen() || readLoginTen() || phoneDigits(p.phone);
    if (ten.length !== 10) return;
    const storedTen = phoneDigits(p.phone);
    if (storedTen.length === 10 && storedTen !== ten) return;
    const clean: ShopIdentity = { ...p, phone: formatInPhone(ten) };
    const raw = JSON.stringify(clean);
    sessionStorage.setItem(`${SHOP_KEY}:${ten}`, raw);
    localStorage.setItem(`${SHOP_KEY}:${ten}`, raw);
    if (clean.isVendor) rememberListedVendor(clean);
    else forgetListedVendor(ten);
  } catch {
    /* ignore */
  }
}
export function vendorFromListing(ten: string, shop: string, industry: Industry | "", name?: string): Vendor {
  const formatted = formatInPhone(ten);
  const title = shop.trim() || name?.trim() || `Shop ${ten}`;
  return {
    id: inboxIdForUser(`vaani-${ten}`),
    name: title,
    shop: title,
    phone: formatted,
    city: "",
    industry: industry || "grocery",
    catalog: [],
    altPhones: [ten, `+91${ten}`, `91${ten}`, `+91 ${ten.slice(0, 5)} ${ten.slice(5)}`, formatted],
  };
}

export function rememberListedVendor(p: { shopName: string; phone: string; industry: Industry | "" }) {
  if (typeof window === "undefined") return;
  const ten = phoneDigits(p.phone);
  const shop = p.shopName.trim();
  if (ten.length !== 10 || !shop) return;
  try {
    const all = JSON.parse(localStorage.getItem(LISTED_KEY) || "{}") as Record<string, Vendor>;
    all[ten] = vendorFromListing(ten, shop, p.industry);
    localStorage.setItem(LISTED_KEY, JSON.stringify(all));
    forgetListedBuyer(ten);
  } catch {
    /* ignore */
  }
}

const BUYERS_KEY = "vaani-listed-buyers-v1";

export function rememberListedBuyer(p: { shopName: string; phone: string }) {
  if (typeof window === "undefined") return;
  const ten = phoneDigits(p.phone);
  if (ten.length !== 10) return;
  try {
    const all = JSON.parse(localStorage.getItem(BUYERS_KEY) || "{}") as Record<string, string>;
    all[ten] = (p.shopName || "").trim() || ten;
    localStorage.setItem(BUYERS_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

export function forgetListedBuyer(phone: string) {
  const ten = phoneDigits(phone);
  if (ten.length !== 10 || typeof window === "undefined") return;
  try {
    const all = JSON.parse(localStorage.getItem(BUYERS_KEY) || "{}") as Record<string, string>;
    delete all[ten];
    localStorage.setItem(BUYERS_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

export function isListedBuyer(phone: string) {
  const ten = phoneDigits(phone);
  if (ten.length !== 10 || typeof window === "undefined") return false;
  try {
    const all = JSON.parse(localStorage.getItem(BUYERS_KEY) || "{}") as Record<string, string>;
    return Boolean(all[ten]);
  } catch {
    return false;
  }
}

export function forgetListedVendor(phone: string) {
  const ten = phoneDigits(phone);
  if (ten.length !== 10 || typeof window === "undefined") return;
  try {
    const all = JSON.parse(localStorage.getItem(LISTED_KEY) || "{}") as Record<string, Vendor>;
    delete all[ten];
    localStorage.setItem(LISTED_KEY, JSON.stringify(all));
    rememberListedBuyer({ shopName: "", phone: ten });
  } catch {
    /* ignore */
  }
}

export function listedVendors(): Vendor[] {
  if (typeof window === "undefined") return [];
  const byTen = new Map<string, Vendor>();
  const put = (ten: string, shop: string, industry: Industry | "", force = false) => {
    const t = phoneDigits(ten);
    const name = (shop || "").trim();
    if (t.length !== 10 || !name) return;
    if (!force && byTen.has(t)) return;
    byTen.set(t, vendorFromListing(t, name, industry));
  };
  try {
    const prefix = "vaani-shop-locked:";
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i) || "";
      if (!key.startsWith(prefix)) continue;
      const ten = phoneDigits(key.slice(prefix.length));
      const p = JSON.parse(localStorage.getItem(key) || "{}") as ShopIdentity;
      const stored = phoneDigits(p.phone);
      if (stored.length === 10 && stored !== ten) continue;
      if (!p.isVendor) continue;
      put(ten, p.shopName, p.industry, true);
    }
  } catch {
    /* ignore */
  }
  try {
    const backups = JSON.parse(localStorage.getItem(BACKUP_KEY) || "{}") as Record<string, AccountBackup>;
    for (const [key, row] of Object.entries(backups)) {
      const ten = phoneDigits(key) || phoneDigits(row.phone);
      if (ten.length !== 10) continue;
      const stored = phoneDigits(row.phone);
      if (stored.length === 10 && stored !== ten) continue;
      if (!row.isVendor) continue;
      put(ten, row.shopName, row.industry);
    }
  } catch {
    /* ignore */
  }
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key?.startsWith(`${SHOP_KEY}:`)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const p = JSON.parse(raw) as ShopIdentity;
      const keyTen = phoneDigits(key.slice(SHOP_KEY.length + 1));
      const stored = phoneDigits(p.phone);
      if (keyTen.length !== 10 || (stored.length === 10 && stored !== keyTen)) continue;
      if (!p.shopName?.trim()) continue;
      if (!p.isVendor) continue;
      put(keyTen, p.shopName, p.industry);
    }
  } catch {
    /* ignore */
  }
  try {
    const all = JSON.parse(localStorage.getItem(LISTED_KEY) || "{}") as Record<string, Vendor>;
    for (const [ten, v] of Object.entries(all)) {
      const t = phoneDigits(ten);
      if (t.length !== 10) continue;
      put(t, v.shop || v.name, v.industry);
    }
  } catch {
    /* ignore */
  }
  try {
    const s = useVaani.getState();
    const self = phoneDigits(s.customerPhone);
    if (self.length === 10 && s.customerName.trim()) {
      put(self, s.customerName, s.industry, true);
    }
  } catch {
    /* ignore */
  }
  return [...byTen.values()];
}
export function restoreLocalAccount(phone?: string) {
  if (typeof window === "undefined") return false;
  const ten = phoneDigits(phone || liveLoginTen() || readLoginTen());
  const s = useVaani.getState();
  const backup = readAccountBackup(ten, s.accountUserId);
  const shop = readShopIdentity(ten);
  let extraTickets: Ticket[] = [];
  let extraIncoming: Ticket[] = [];
  if (ten.length === 10) {
    try {
      const raw = localStorage.getItem(`vaani-tickets-v1:${ten}`) || sessionStorage.getItem(`vaani-tickets-v1:${ten}`);
      if (raw) {
        const parsed = JSON.parse(raw) as { tickets?: Ticket[]; incoming?: Ticket[] };
        extraTickets = parsed.tickets ?? [];
        extraIncoming = parsed.incoming ?? [];
      }
    } catch {
      /* ignore */
    }
  }
const prevTen = phoneDigits(s.customerPhone);
  const sameUser = prevTen.length === 10 && prevTen === ten;
  const shopName = (backup?.shopName || shop?.shopName || (sameUser ? s.customerName : "") || "").trim();
  const formatted = formatInPhone(backup?.phone || shop?.phone || ten || s.customerPhone);
  const industry = backup?.industry || shop?.industry || s.industry || "";
  const isVendor = Boolean(backup?.isVendor || shop?.isVendor || s.isVendor);
  const language = readUiLanguage() || shop?.language || backup?.language || s.language || "en-IN";
  const claimed = backup?.claimedVendorId || s.claimedVendorId || "";
  const tickets = mergeTicketLists(mergeTicketLists(s.tickets, backup?.tickets ?? []), extraTickets);
  const incoming = mergeTicketLists(mergeTicketLists(s.incoming, backup?.incoming ?? []), extraIncoming);
  if (ten.length === 10) rememberLoginTen(ten);
  applyDirContacts();
  if (shopName) {
    s.setShopIdentity({
      shopName,
      phone: formatted,
      industry,
      isVendor,
      language,
    });
    writeShopCookies({ shopName, phone: formatted, industry, isVendor, language });
  } else if (ten.length === 10 && phoneDigits(s.customerPhone) !== ten) {
    useVaani.setState({ customerPhone: formatted });
  }
  if (claimed && !s.claimedVendorId) s.setClaimedVendor(claimed);
  if (tickets.length) s.replaceTickets(tickets);
  if (incoming.length) s.replaceIncoming(incoming);
  if (shopName || tickets.length || incoming.length) {
    s.setAccountReady(true);
    writeAccountBackup();
    return true;
  }
  return false;
}
