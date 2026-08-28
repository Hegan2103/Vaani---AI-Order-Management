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
  useVaani.setState({ contacts: rows });
}

export function readDirContacts(): Contact[] | null {
  if (typeof window === "undefined") return null;
  try {
    const flag = sessionStorage.getItem(DIR_FLAG) || localStorage.getItem(DIR_FLAG);
    const raw = sessionStorage.getItem(DIR_KEY) || localStorage.getItem(DIR_KEY);
    if (flag !== "1" && !raw) return null;
    if (!raw) return [];
    const rows = JSON.parse(raw) as Contact[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return null;
  }
}

export function applyDirContacts() {
  const rows = readDirContacts();
  if (rows == null) return false;
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
  try {
    const raw = localStorage.getItem(SHOP_KEY) || sessionStorage.getItem(SHOP_KEY) || "";
    const t = tryTen(JSON.parse(raw || "{}").phone || "");
    if (t) return t;
  } catch {
    /* ignore */
  }
  try {
    const store = JSON.parse(localStorage.getItem("vaani-store-v3") || "{}") as { state?: { customerPhone?: string } };
    const t = tryTen(store?.state?.customerPhone || "");
    if (t) return t;
  } catch {
    /* ignore */
  }
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i) || "";
      if (!key.startsWith(`${SHOP_KEY}:`)) continue;
      const t = tryTen(key.slice(SHOP_KEY.length + 1));
      if (t) return t;
    }
  } catch {
    /* ignore */
  }
  try {
    const known = JSON.parse(localStorage.getItem("vaani-known-phones") || "[]") as string[];
    for (let i = known.length - 1; i >= 0; i -= 1) {
      const t = tryTen(known[i]);
      if (t) return t;
    }
  } catch {
    /* ignore */
  }
  return "";
}

export function liveLoginTen() {
  if (typeof window === "undefined") return "";
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
    const raw = JSON.stringify(p);
    sessionStorage.setItem(SHOP_KEY, raw);
    localStorage.setItem(SHOP_KEY, raw);
    const ten = phoneDigits(p.phone);
    if (ten.length === 10) {
      sessionStorage.setItem(`${SHOP_KEY}:${ten}`, raw);
      localStorage.setItem(`${SHOP_KEY}:${ten}`, raw);
    }
    if (p.shopName.trim()) writeShopCookies(p);
    if (ten.length === 10 && p.shopName.trim()) rememberListedVendor(p);
  } catch {
    /* ignore */
  }
}

function vendorFromListing(ten: string, shop: string, industry: Industry | "", name?: string): Vendor {
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
  } catch {
    /* ignore */
  }
}

export function listedVendors(): Vendor[] {
  if (typeof window === "undefined") return [];
  const byTen = new Map<string, Vendor>();
  try {
    const all = JSON.parse(localStorage.getItem(LISTED_KEY) || "{}") as Record<string, Vendor>;
    for (const [ten, v] of Object.entries(all)) {
      if (phoneDigits(ten).length === 10) byTen.set(phoneDigits(ten), v);
    }
  } catch {
    /* ignore */
  }
  try {
    const backups = JSON.parse(localStorage.getItem(BACKUP_KEY) || "{}") as Record<string, AccountBackup>;
    for (const [key, row] of Object.entries(backups)) {
      const ten = phoneDigits(key) || phoneDigits(row.phone);
      if (ten.length !== 10) continue;
      if (!byTen.has(ten)) {
        byTen.set(ten, vendorFromListing(ten, row.shopName || `Shop ${ten}`, row.industry, row.shopName));
      }
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
      const ten = phoneDigits(p.phone) || phoneDigits(key.slice(SHOP_KEY.length + 1));
      if (ten.length !== 10 || !p.shopName?.trim()) continue;
      if (!byTen.has(ten)) {
        byTen.set(ten, vendorFromListing(ten, p.shopName, p.industry));
      }
    }
  } catch {
    /* ignore */
  }
  try {
    const s = useVaani.getState();
    const self = phoneDigits(s.customerPhone);
    if (self.length === 10 && s.customerName.trim()) {
      byTen.set(self, vendorFromListing(self, s.customerName, s.industry));
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

type State = {
  role: Role;
  customerName: string;
  customerPhone: string;
  industry: Industry | "";
  isVendor: boolean;
  language: string;
  shopSaved: boolean;
  claimedVendorId: string;
  liveVendors: Vendor[];
  contacts: Contact[];
  tickets: Ticket[];
  incoming: Ticket[];
  notices: VaaniNotice[];
  accountUserId: string;
  accountReady: boolean;
  hydrated: boolean;
  callVendorId: string;
  setHydrated: (v: boolean) => void;
  resetForUser: (userId: string) => void;
  setAccountReady: (v: boolean) => void;
  setRole: (role: Role) => void;
  setProfile: (name: string, phone: string) => void;
  setShopIdentity: (p: ShopIdentity) => void;
  setLanguage: (language: string) => void;
  setClaimedVendor: (vendorId: string) => void;
  setCallVendorId: (vendorId: string) => void;
  setLiveVendors: (vendors: Vendor[]) => void;
  mergeContacts: (extra: Contact[]) => void;
  upsertTicket: (ticket: Ticket) => void;
  upsertIncoming: (ticket: Ticket) => void;
  replaceTickets: (tickets: Ticket[]) => void;
  replaceIncoming: (tickets: Ticket[]) => void;
  pushNotices: (events: VaaniNotice[]) => void;
  markNoticesRead: () => void;
  updateLines: (ticketId: string, lines: LineItem[], status?: TicketStatus) => void;
  setOrderCopy: (ticketId: string, copy: string) => void;
};

export function vendorById(id: string) {
  const seed = VENDORS.find((v) => v.id === id);
  if (seed) return seed;
  try {
    const live = useVaani.getState().liveVendors.find((v) => v.id === id);
    if (live) return live;
  } catch {
    /* ignore */
  }
  const listed = listedVendors().find((v) => v.id === id);
  if (listed) return listed;
  const ten = String(id).match(/(\d{10})/)?.[1] || "";
  return ten ? vendorForPhone(ten) : undefined;
}

export function vendorForPhone(phone: string) {
  const ten = phoneDigits(phone);
  if (ten.length !== 10) return undefined;
  const seed = VENDORS.find((v) => phonesMatch(v.phone, phone) || (v.altPhones ?? []).some((p) => phonesMatch(p, phone)));
  if (seed) return seed;
  try {
    const s = useVaani.getState();
    const live = s.liveVendors.find(
      (v) => phonesMatch(v.phone, phone) || (v.altPhones ?? []).some((p) => phonesMatch(p, phone)),
    );
    if (live) return live;
  } catch {
    /* ignore */
  }
  const listed = listedVendors().find(
    (v) => phonesMatch(v.phone, phone) || (v.altPhones ?? []).some((p) => phonesMatch(p, phone)),
  );
  if (listed) return listed;
  try {
    const shop = readShopIdentity(ten);
    if (shop?.shopName?.trim() && (phoneDigits(shop.phone) === ten || !shop.phone)) {
      return vendorFromListing(ten, shop.shopName, shop.industry);
    }
  } catch {
    /* ignore */
  }
  try {
    const backup = readAccountBackup(ten);
    if (backup?.shopName?.trim()) {
      return vendorFromListing(ten, backup.shopName, backup.industry);
    }
  } catch {
    /* ignore */
  }
  try {
    const raw = localStorage.getItem(`${SHOP_KEY}:${ten}`) || sessionStorage.getItem(`${SHOP_KEY}:${ten}`);
    if (raw) {
      const p = JSON.parse(raw) as ShopIdentity;
      if (p.shopName?.trim()) return vendorFromListing(ten, p.shopName, p.industry);
    }
  } catch {
    /* ignore */
  }
  try {
    const known = JSON.parse(localStorage.getItem("vaani-known-phones") || "[]") as string[];
    if (known.some((k) => phoneDigits(k) === ten)) {
      return vendorFromListing(ten, `Shop ${ten}`, "grocery");
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

export function onVaaniVendor(phone: string, vendorId?: string | null) {
  const byPhone = vendorForPhone(phone);
  if (byPhone) return byPhone;
  if (vendorId) {
    const seed = vendorById(vendorId);
    if (seed) return seed;
  }
  return undefined;
}

function relink(contacts: Contact[], live: Vendor[]): Contact[] {
  const all = [...VENDORS, ...live, ...listedVendors()];
  return contacts.map((c) => {
    const hit = all.find(
      (v) => phonesMatch(v.phone, c.phone) || (v.altPhones ?? []).some((p) => phonesMatch(p, c.phone)),
    );
    return hit ? { ...c, vendorId: hit.id } : c;
  });
}

export function isOwnCustomerOrder(ticket: Ticket, phone: string) {
  const ten = phoneDigits(phone);
  if (!ten) return false;
  return phoneDigits(ticket.customerPhone) === ten;
}

export function readLastTicket(): Ticket | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(LAST_TICKET_KEY);
    return raw ? (JSON.parse(raw) as Ticket) : null;
  } catch {
    return null;
  }
}

function writeLastTicket(ticket: Ticket) {
  try {
    sessionStorage.setItem(LAST_TICKET_KEY, JSON.stringify(ticket));
  } catch {
    /* ignore */
  }
}

function patchList(list: Ticket[], ticketId: string, fn: (t: Ticket) => Ticket) {
  return list.map((t) => (t.id === ticketId ? fn(t) : t));
}

export const useVaani = create<State>()(
  persist(
    (set) => ({
      role: "customer",
      customerName: "",
      customerPhone: "",
      industry: "",
      isVendor: false,
      language: "en-IN",
      shopSaved: false,
      claimedVendorId: "",
      liveVendors: [],
      contacts: [],
      tickets: [],
      incoming: [],
      notices: [],
      accountUserId: "",
      accountReady: false,
      hydrated: false,
      callVendorId: "",
      setHydrated: (hydrated) => set({ hydrated }),
      setAccountReady: (accountReady) => set({ accountReady }),
      resetForUser: (userId) =>
        set((s) => {
          if (s.accountUserId === userId) return s;
          return { accountUserId: userId, accountReady: false };
        }),
      setRole: (role) => set({ role }),
      setProfile: (customerName, customerPhone) =>
        set((s) => {
          const name = customerName.trim() || s.customerName;
          const phone = customerPhone.trim() || s.customerPhone;
          return {
            customerName: name,
            customerPhone: phone,
            shopSaved: s.shopSaved || name.length > 0,
          };
        }),
      setShopIdentity: (p) => {
        const s = useVaani.getState();
        const shopName = p.shopName.trim() || s.customerName;
        const phone = p.phone.trim() || s.customerPhone;
        const language = p.language || s.language || readUiLanguage() || "en-IN";
        const industry = p.industry || s.industry || "";
        const isVendor = Boolean(p.isVendor || s.isVendor);
        if (
          s.customerName === shopName &&
          s.customerPhone === phone &&
          s.industry === industry &&
          s.isVendor === isVendor &&
          s.language === language &&
          s.shopSaved === (shopName.length > 0)
        ) {
          return;
        }
        if (!shopName) return;
        writeShopIdentity({ shopName, phone, industry, isVendor, language });
        if (isVendor) rememberListedVendor({ shopName, phone, industry });
        set({
          customerName: shopName,
          customerPhone: phone,
          industry,
          isVendor,
          language,
          shopSaved: true,
        });
        queueMicrotask(() => writeAccountBackup());
      },
      setLanguage: (language) =>
        set((s) => {
          const next = language || s.language || readUiLanguage() || "en-IN";
          writeUiLanguage(next);
          if (s.customerName.trim()) {
            writeShopIdentity({
              shopName: s.customerName,
              phone: s.customerPhone,
              industry: s.industry,
              isVendor: s.isVendor,
              language: next,
            });
            queueMicrotask(() => writeAccountBackup());
          }
          return { language: next };
        }),
      setClaimedVendor: (claimedVendorId) => set({ claimedVendorId }),
      setCallVendorId: (callVendorId) => set({ callVendorId }),
      setLiveVendors: (liveVendors) =>
        set((s) => ({
          liveVendors,
          contacts: readDirContacts() ?? relink(s.contacts, liveVendors),
        })),
      mergeContacts: (extra) =>
        set((s) => {
          const byDigits = new Map(s.contacts.map((c) => [phoneDigits(c.phone), c]));
          const next = [...s.contacts];
          for (const c of extra) {
            const key = phoneDigits(c.phone);
            if (key.length !== 10) continue;
            const existing = byDigits.get(key);
            if (!existing) {
              next.push(c);
              byDigits.set(key, c);
            } else {
              const i = next.findIndex((x) => phoneDigits(x.phone) === key);
              if (i < 0) continue;
              next[i] = {
                ...next[i],
                name: c.source === "phone" && c.name.trim() ? c.name.trim() : next[i].name,
                vendorId: c.vendorId || next[i].vendorId,
                source: c.source === "phone" ? "phone" : next[i].source,
              };
              byDigits.set(key, next[i]);
            }
          }
          return { contacts: relink(next, s.liveVendors) };
        }),
      upsertTicket: (ticket) => {
        writeLastTicket(ticket);
        set((s) => {
          const i = s.tickets.findIndex((t) => t.id === ticket.id);
          if (i === -1) return { tickets: [ticket, ...s.tickets] };
          const tickets = s.tickets.slice();
          tickets[i] = mergeOneTicket(tickets[i], ticket);
          return { tickets };
        });
        queueMicrotask(() => writeAccountBackup());
      },
      upsertIncoming: (ticket) => {
        writeLastTicket(ticket);
        set((s) => {
          const i = s.incoming.findIndex((t) => t.id === ticket.id);
          if (i === -1) return { incoming: [ticket, ...s.incoming] };
          const incoming = s.incoming.slice();
          incoming[i] = mergeOneTicket(incoming[i], ticket);
          return { incoming };
        });
        queueMicrotask(() => writeAccountBackup());
      },
      replaceTickets: (tickets) =>
        set((s) => {
          if (!tickets.length) return s;
          return { tickets: mergeTicketLists(s.tickets, tickets) };
        }),
      replaceIncoming: (incoming) =>
        set((s) => {
          const ten = phoneDigits(s.customerPhone);
          const dropSelf = (list: Ticket[]) =>
            ten ? list.filter((t) => phoneDigits(t.customerPhone) !== ten) : list;
          return { incoming: mergeTicketLists(dropSelf(s.incoming), dropSelf(incoming)) };
        }),
      pushNotices: (events) =>
        set((s) => ({
          notices: [...events, ...s.notices].slice(0, 40),
        })),
      markNoticesRead: () =>
        set((s) => ({
          notices: s.notices.map((n) => ({ ...n, read: true })),
        })),
      updateLines: (ticketId, lines, status) =>
        set((s) => {
          const apply = (t: Ticket) => ({
            ...t,
            lines,
            status: status ?? deriveStatus(lines, t.status),
            updatedAt: new Date().toISOString(),
          });
          const tickets = patchList(s.tickets, ticketId, apply);
          const incoming = patchList(s.incoming, ticketId, apply);
          const current = tickets.find((t) => t.id === ticketId) ?? incoming.find((t) => t.id === ticketId);
          if (current) writeLastTicket(current);
          return { tickets, incoming };
        }),
      setOrderCopy: (ticketId, copy) =>
        set((s) => {
          const apply = (t: Ticket) => ({ ...t, orderCopy: copy, status: "finalized" as const });
          const tickets = patchList(s.tickets, ticketId, apply);
          const incoming = patchList(s.incoming, ticketId, apply);
          const current = tickets.find((t) => t.id === ticketId) ?? incoming.find((t) => t.id === ticketId);
          if (current) writeLastTicket(current);
          return { tickets, incoming };
        }),
    }),
    {
      name: "vaani-store-v3",
      skipHydration: true,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        const disk = readShopIdentity(p.customerPhone || current.customerPhone);
        const name = (current.customerName || p.customerName || disk?.shopName || "").trim();
        const phone = (current.customerPhone || p.customerPhone || disk?.phone || "").trim();
        return {
          ...current,
          role: p.role || current.role,
          customerName: name,
          customerPhone: phone,
          industry: current.industry || p.industry || disk?.industry || "",
          isVendor: Boolean(current.isVendor || p.isVendor || disk?.isVendor),
          language: current.language || p.language || disk?.language || readUiLanguage() || "en-IN",
          shopSaved: Boolean(current.shopSaved || p.shopSaved || name),
          accountUserId: current.accountUserId || p.accountUserId || "",
          accountReady: Boolean(name || current.shopSaved || p.tickets?.length || current.tickets?.length),
          tickets: mergeTicketLists(p.tickets ?? [], current.tickets),
          incoming: mergeTicketLists(p.incoming ?? [], current.incoming),
          claimedVendorId: current.claimedVendorId || p.claimedVendorId || "",
          contacts: readDirContacts() ?? current.contacts,
          notices: current.notices?.length ? current.notices : p.notices ?? [],
        };
      },
      partialize: (s) => ({
        role: s.role,
        customerName: s.customerName,
        customerPhone: s.customerPhone,
        industry: s.industry,
        isVendor: s.isVendor,
        language: s.language,
        shopSaved: s.shopSaved || Boolean(s.customerName.trim()),
        claimedVendorId: s.claimedVendorId,
        accountUserId: s.accountUserId,
        tickets: s.tickets,
        incoming: s.incoming,
        notices: s.notices.slice(0, 20),
      }),
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          if (typeof window === "undefined") return null;
          return localStorage.getItem(name) || sessionStorage.getItem(name);
        },
        setItem: (name, value) => {
          if (typeof window === "undefined") return;
          try {
            const prevRaw = localStorage.getItem(name);
            if (prevRaw) {
              const next = JSON.parse(value) as { state?: Partial<State> };
              const prev = JSON.parse(prevRaw) as { state?: Partial<State> };
              const ns = next.state ?? (next as Partial<State>);
              const ps = prev.state ?? (prev as Partial<State>);
              const nextEmpty = !String(ns.customerName || "").trim() && !ns.tickets?.length && !ns.incoming?.length;
              const prevFull = Boolean(String(ps.customerName || "").trim() || ps.tickets?.length || ps.incoming?.length);
              if (nextEmpty && prevFull) return;
              if (!ns.tickets?.length && ps.tickets?.length) ns.tickets = ps.tickets;
              if (!ns.incoming?.length && ps.incoming?.length) ns.incoming = ps.incoming;
              if (!String(ns.customerName || "").trim() && String(ps.customerName || "").trim()) {
                ns.customerName = ps.customerName;
                ns.customerPhone = ns.customerPhone || ps.customerPhone;
                ns.industry = ns.industry || ps.industry;
                ns.isVendor = ns.isVendor || ps.isVendor;
                ns.shopSaved = true;
                ns.language = ns.language || ps.language;
                ns.claimedVendorId = ns.claimedVendorId || ps.claimedVendorId;
              }
              if ("state" in next) next.state = ns;
              const packed = JSON.stringify(next);
              localStorage.setItem(name, packed);
              sessionStorage.setItem(name, packed);
              return;
            }
          } catch {
            /* fall through */
          }
          localStorage.setItem(name, value);
          try {
            sessionStorage.setItem(name, value);
          } catch {
            /* ignore */
          }
        },
        removeItem: (name) => {
          if (typeof window === "undefined") return;
          localStorage.removeItem(name);
        },
      })),
    },
  ),
);


function deriveStatus(lines: LineItem[], current: TicketStatus): TicketStatus {
  if (current === "finalized" || current === "delivered") return current;
  if (lines.length === 0) return current;
  const allDone = lines.every((l) => l.status !== "pending");
  if (!allDone) return current === "draft" ? "draft" : "reviewing";
  if (lines.some((l) => l.status === "quoted")) return "quoted";
  if (lines.some((l) => l.status === "accepted" || l.status === "confirmed")) return "confirmed";
  return current;
}

const LINE_RANK: Record<string, number> = {
  pending: 0,
  quoted: 1,
  accepted: 2,
  rejected: 2,
  confirmed: 3,
};

const TICKET_RANK: Record<string, number> = {
  draft: 0,
  sent: 1,
  reviewing: 2,
  quoted: 3,
  confirmed: 4,
  finalized: 5,
  delivered: 6,
};

export function mergeLines(a: LineItem[], b: LineItem[], preferB = false): LineItem[] {
  const preferred = preferB ? b : a;
  const other = preferB ? a : b;
  const otherMap = new Map(other.map((l) => [l.id, l]));
  return preferred.map((l) => {
    const prev = otherMap.get(l.id);
    if (!prev) return l;
    const pr = LINE_RANK[prev.status] ?? 0;
    const nr = LINE_RANK[l.status] ?? 0;
    if (nr >= pr) return { ...prev, ...l };
    return { ...l, ...prev, id: l.id, productName: l.productName || prev.productName };
  });
}

function mergeTranscript(a: string, b: string) {
  const left = (a || "").trim();
  const right = (b || "").trim();
  if (!left) return right;
  if (!right) return left;
  if (left.includes(right)) return left;
  if (right.includes(left)) return right;
  return `${left}\n${right}`;
}

export function mergeOneTicket(local: Ticket | undefined, remote: Ticket): Ticket {
  if (!local) return remote;
  const localRank = TICKET_RANK[local.status] ?? 0;
  const remoteRank = TICKET_RANK[remote.status] ?? 0;
  const localTs = Date.parse(local.updatedAt || local.createdAt) || 0;
  const remoteTs = Date.parse(remote.updatedAt || remote.createdAt) || 0;
  const preferRemote = remoteRank > localRank || (remoteRank === localRank && remoteTs > localTs);
  const base = preferRemote ? { ...local, ...remote } : { ...remote, ...local };
  return {
    ...base,
    lines: mergeLines(local.lines, remote.lines, remoteTs > localTs),
    orderCopy: local.orderCopy || remote.orderCopy,
    status: preferRemote ? remote.status : local.status,
    transcript: mergeTranscript(local.transcript, remote.transcript),
    notes: base.notes || local.notes || remote.notes,
    updatedAt: remoteTs >= localTs ? remote.updatedAt || local.updatedAt : local.updatedAt || remote.updatedAt,
  };
}

export function mergeTicketLists(local: Ticket[], remote: Ticket[]) {
  const map = new Map<string, Ticket>();
  for (const t of local) map.set(t.id, t);
  for (const t of remote) map.set(t.id, mergeOneTicket(map.get(t.id), t));
  return [...map.values()].sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt));
}

export function findOpenTicket(vendorId: string): Ticket | undefined {
  const s = useVaani.getState();
  const open = (t: Ticket) =>
    t.vendorId === vendorId && t.status !== "finalized" && t.status !== "delivered";
  return s.tickets.find(open) ?? s.incoming.find(open);
}

export function clearLocalVaani() {
  const keys = [
    "vaani-store-v3",
    "vaani-store-v2",
    "vaani-store-v1",
    SHOP_KEY,
    BACKUP_KEY,
    LOGIN_PHONE_KEY,
    LAST_TICKET_KEY,
    "vaani-otp-draft-v1",
    "vaani-otp-lock",
    "vaani-bearer-v1",
    "grok-auth.bearer-token",
  ];
  try {
    for (const key of keys) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
  useVaani.setState({
    customerName: "",
    customerPhone: "",
    industry: "",
    isVendor: false,
    shopSaved: false,
    claimedVendorId: "",
    tickets: [],
    incoming: [],
    notices: [],
    accountUserId: "",
    accountReady: false,
    language: "en-IN",
    role: "customer",
    callVendorId: "",
  });
}
