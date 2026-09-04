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
