import { Component, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { storeBearerToken, signInGoogle } from "@/lib/auth/client";
import {
  liveLoginTen,
  loginPhoneKey,
  readLoginTen,
  readUiLanguage,
  rememberLoginTen,
  restoreLocalAccount,
  useVaani,
  writeUiLanguage,
} from "@/lib/vaani/store";
import { LANGUAGES } from "@/lib/vaani/seed";
import { isRtl, t as tr, useT } from "@/lib/vaani/i18n";

const ENTERED_KEY = "vaani-entered";
const TYPING_KEY = "vaani-typing-phone";
let stickyEntered = false;
let signedOutLock = false;
let typed = "";

function toTen(raw: string) {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.startsWith("91") && d.length >= 12) d = d.slice(2);
  if (d.startsWith("0") && d.length === 11) d = d.slice(1);
  return d.slice(0, 10);
}

function persistTyping(ten: string) {
  typed = ten;
  try {
    sessionStorage.setItem(TYPING_KEY, ten);
    localStorage.setItem(TYPING_KEY, ten);
  } catch {
    /* ignore */
  }
}

export function isSignedOut() {
  if (signedOutLock) return true;
  try {
    return sessionStorage.getItem("vaani-signed-out") === "1" || localStorage.getItem("vaani-signed-out") === "1";
  } catch {
    return false;
  }
}

function markEntered() {
  stickyEntered = true;
  signedOutLock = false;
  try {
    sessionStorage.removeItem("vaani-signed-out");
    localStorage.removeItem("vaani-signed-out");
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(ENTERED_KEY, "1");
    sessionStorage.setItem(ENTERED_KEY, "1");
  } catch {
    /* ignore */
  }
  try {
    document.cookie = `${ENTERED_KEY}=1; path=/; max-age=2592000; SameSite=Lax`;
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event("vaani-auth"));
}

export function keepSession() {
  if (isSignedOut()) return;
  if (readLoginTen().length === 10) markEntered();
}
export function setOtpLock(_on: boolean) {}
export function markSessionOk(on: boolean) {
  if (on) markEntered();
  else resetLoginGate();
}

export function resetLoginGate() {
  stickyEntered = false;
  signedOutLock = true;
  typed = "";
  try {
    const phoneKey = loginPhoneKey();
    localStorage.removeItem(ENTERED_KEY);
    sessionStorage.removeItem(ENTERED_KEY);
    localStorage.removeItem("vaani-store-v3");
    sessionStorage.removeItem("vaani-store-v3");
    localStorage.removeItem("vaani-restored");
    localStorage.removeItem(phoneKey);
    sessionStorage.removeItem(phoneKey);
    localStorage.removeItem(TYPING_KEY);
    sessionStorage.removeItem(TYPING_KEY);
    localStorage.removeItem("vaani-shop-locked");
    sessionStorage.removeItem("vaani-shop-locked");
    localStorage.removeItem("vaani-shop-identity-v1");
    sessionStorage.removeItem("vaani-shop-identity-v1");
    sessionStorage.setItem("vaani-signed-out", "1");
    localStorage.setItem("vaani-signed-out", "1");
  } catch {
    /* ignore */
  }
  try {
    useVaani.setState({
      customerName: "",
      customerPhone: "",
      industry: "",
      isVendor: false,
      shopSaved: false,
      tickets: [],
      incoming: [],
    });
  } catch {
    /* ignore */
  }
  try {
    document.cookie = `${ENTERED_KEY}=; path=/; max-age=0`;
    document.cookie = "vaani_phone=; path=/; max-age=0";
  } catch {
    /* ignore */
  }
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("v");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    /* ignore */
  }
  try {
    const bar = document.getElementById("vaani-cred-bar");
    if (bar) {
      bar.textContent = "";
      bar.style.display = "none";
    }
    document.documentElement.removeAttribute("data-vaani-phone");
    document.documentElement.removeAttribute("data-vaani-shop");
  } catch {
    /* ignore */
  }
  storeBearerToken(null);
  window.dispatchEvent(new Event("vaani-auth"));
}
