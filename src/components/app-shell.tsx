import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, Phone, Store } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { CustomerHome } from "@/components/customer-home";
import { resetLoginGate } from "@/components/login-screen";
import { VendorHome } from "@/components/vendor-home";
import { CallScreen } from "@/routes/call.$vendorId";
import { Button } from "@/components/ui/button";
import { storeBearerToken } from "@/lib/auth/client";
import { cn } from "@/lib/cn";
import { unlockBeep } from "@/lib/vaani/notify";
import { LANGUAGES, formatInPhone, phoneDigits } from "@/lib/vaani/seed";
import { isRtl, useT } from "@/lib/vaani/i18n";
import {
  mergeTicketLists,
  readAccountBackup,
  liveLoginTen,
  readLoginTen,
  readUiLanguage,
  rememberLoginTen,
  restoreLocalAccount,
  applyDirContacts,
  readShopIdentity,
  tenFromEmail,
  useVaani,
  writeAccountBackup,
  writeShopIdentity,
  writeUiLanguage,
} from "@/lib/vaani/store";
import type { Industry, Ticket } from "@/lib/vaani/types";

export function AppShell({ children, seedPhone }: { children: ReactNode; seedPhone?: string }) {
  const seedTen = phoneDigits(seedPhone || "") || (typeof window !== "undefined" ? liveLoginTen() || readLoginTen() : "");
  if (seedTen.length === 10 && phoneDigits(useVaani.getState().customerPhone) !== seedTen) {
    useVaani.setState({ customerPhone: formatInPhone(seedTen) });
    if (typeof window !== "undefined") restoreLocalAccount(seedTen);
  }
  const role = useVaani((s) => s.role);
  const setRole = useVaani((s) => s.setRole);
  const setShopIdentity = useVaani((s) => s.setShopIdentity);
  const setLanguage = useVaani((s) => s.setLanguage);
  const language = useVaani((s) => s.language);
  const { t } = useT();
  const customerPhone = useVaani((s) => s.customerPhone);
  const customerName = useVaani((s) => s.customerName);
  const setClaimedVendor = useVaani((s) => s.setClaimedVendor);
  const claimedVendorId = useVaani((s) => s.claimedVendorId);
  const replaceTickets = useVaani((s) => s.replaceTickets);
  const replaceIncoming = useVaani((s) => s.replaceIncoming);
  const setLiveVendors = useVaani((s) => s.setLiveVendors);
  const pushNotices = useVaani((s) => s.pushNotices);
  const resetForUser = useVaani((s) => s.resetForUser);
  const setAccountReady = useVaani((s) => s.setAccountReady);
  const callVendorId = useVaani((s) => s.callVendorId);
  const setCallVendorId = useVaani((s) => s.setCallVendorId);
  const hydrated = useVaani((s) => s.hydrated);
  const accountReady = useVaani((s) => s.accountReady);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onDesk = (pathname === "/" || pathname === "/vendor") && !callVendorId;
  const customerOn = onDesk ? pathname !== "/vendor" : role === "customer";
  const vendorOn = onDesk ? pathname === "/vendor" : role === "vendor";
  const loginTen = readLoginTen();
  const snap = typeof window !== "undefined" ? readShopIdentity(customerPhone || loginTen) : null;
  const snapName = (snap?.shopName || "").trim();
  const snapPhone = snap?.phone || "";
  const userId = loginTen ? `vaani-${loginTen}` : "";
  const userEmail = loginTen ? `91${loginTen}@phone.vaani.app` : "";
  const userName = loginTen;
  const isPending = false;
  const user = loginTen
    ? { id: userId, displayName: userName, primaryEmail: userEmail }
    : null;
  const prevFp = useRef("");
  const prevAll = useRef<Ticket[]>([]);
  const restoredFor = useRef("");

  useLayoutEffect(() => {
    const hasChip =
      phoneDigits(customerPhone || snapPhone || loginTen).length === 10 &&
      Boolean((customerName || snapName).trim());
    const bar = document.getElementById("vaani-cred-bar");
    if (hasChip && bar) bar.style.display = "none";
  }, [customerPhone, customerName, snapPhone, snapName, loginTen]);

  useEffect(() => {
    const dump = () => {
      const s = useVaani.getState();
      if (s.customerName.trim()) {
        s.setShopIdentity({
          shopName: s.customerName,
          phone: s.customerPhone,
          industry: s.industry,
          isVendor: s.isVendor,
          language: s.language || "en-IN",
        });
      }
      writeAccountBackup();
    };
    window.addEventListener("pagehide", dump);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") dump();
    });
    return () => {
      window.removeEventListener("pagehide", dump);
    };
  }, []);

  useLayoutEffect(() => {
    useVaani.getState().setHydrated(true);
    const ten = liveLoginTen() || readLoginTen() || phoneDigits(seedPhone || "") || phoneDigits(useVaani.getState().customerPhone);
    if (ten.length === 10) {
      rememberLoginTen(ten);
      restoreLocalAccount(ten);
      applyDirContacts();
    }
    void Promise.resolve(useVaani.persist.rehydrate()).then(() => {
      useVaani.getState().setHydrated(true);
      const n = readLoginTen() || phoneDigits(useVaani.getState().customerPhone);
      restoreLocalAccount(n);
      applyDirContacts();
      const s = useVaani.getState();
      if (s.language) writeUiLanguage(s.language);
      if (s.customerName.trim() || s.tickets.length || s.incoming.length) {
        s.setAccountReady(true);
        writeAccountBackup();
      }
    });
  }, [seedPhone]);

  useEffect(() => {
    const ten = tenFromEmail(userEmail) || phoneDigits(userName) || readLoginTen();
    if (ten.length !== 10) return;
    rememberLoginTen(ten);
    restoreLocalAccount(ten);
    const formatted = formatInPhone(ten);
    const s = useVaani.getState();
    if (phoneDigits(s.customerPhone) !== ten) {
      useVaani.setState({ customerPhone: formatted });
      const snap = readShopIdentity(ten);
      if (snap) writeShopIdentity({ ...snap, phone: formatted });
    }
  }, [userId, userEmail, userName]);

  useEffect(() => {
    const arm = () => unlockBeep();
    window.addEventListener("pointerdown", arm);
    window.addEventListener("keydown", arm);
    return () => {
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
    };
  }, []);

  useEffect(() => {
    const ten = tenFromEmail(userEmail) || readLoginTen();
    if (ten.length === 10) restoreLocalAccount(ten);
    if (isPending || !hydrated) return;
    const restoreKey = `${userId || "local"}:${ten || "pending"}`;
    const alreadyFetched = (() => {
      try {
        return localStorage.getItem("vaani-restored") === restoreKey;
      } catch {
        return restoredFor.current === restoreKey;
      }
    })();
    restoredFor.current = restoreKey;
    const backup = readAccountBackup(ten, userId);
    if (backup?.shopName?.trim()) {
      setShopIdentity({
        shopName: backup.shopName,
        phone: backup.phone || formatInPhone(ten),
        industry: backup.industry,
        isVendor: backup.isVendor,
        language: readUiLanguage() || language || backup.language || "en-IN",
      });
    }
    if (backup?.tickets?.length) replaceTickets(backup.tickets);
    if (backup?.incoming?.length) replaceIncoming(backup.incoming);
    if (backup?.claimedVendorId) setClaimedVendor(backup.claimedVendorId);
    if (backup?.shopName?.trim() || backup?.tickets?.length || backup?.incoming?.length) {
      setAccountReady(true);
    }
    setAccountReady(true);
  }, [isPending, userId, userEmail, hydrated]);

  useEffect(() => {
    if (pathname === "/vendor") setRole("vendor");
    else if (pathname === "/") setRole("customer");
  }, [pathname, setRole]);

  useEffect(() => {
    const lang = language || "en-IN";
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtl(lang) ? "rtl" : "ltr";
  }, [language]);

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <header className="no-print sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="font-display text-xl tracking-tight">Vaani</span>
            <span className="hidden text-xs text-muted sm:inline">{t("voiceOrders")}</span>
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-[var(--radius-lg)] border border-line bg-surface p-1">
              <Link
                to="/"
                onClick={() => {
                  setRole("customer");
                  setCallVendorId("");
                }}
                className={cn(
                  "inline-flex h-8 items-center gap-1 rounded-full px-3 text-sm font-medium",
                  customerOn ? "bg-accent text-accent-fg" : "text-muted",
                )}
              >
                <Phone className="size-3.5" />
                {t("customer")}
              </Link>
              <Link
                to="/vendor"
                onClick={() => {
                  setRole("vendor");
                  setCallVendorId("");
                }}
                className={cn(
                  "inline-flex h-8 items-center gap-1 rounded-full px-3 text-sm font-medium",
                  vendorOn ? "bg-accent text-accent-fg" : "text-muted",
                )}
              >
                <Store className="size-3.5" />
                {t("vendor")}
              </Link>
            </div>
            <select
              aria-label={t("language")}
              value={language || "en-IN"}
              onChange={(e) => {
                const next = e.target.value;
                setLanguage(next);
              }}
              className="h-9 max-w-[9.5rem] rounded-[var(--radius-sm)] border border-line bg-surface px-2 text-xs"
            >
              {LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
            <NoticeBell />
            <SignedInPhone
              phone={customerPhone || snapPhone || readLoginTen()}
              shop={customerName || snapName}
            />
            <AccountBar />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-6">
        {callVendorId && pathname !== "/vendor" ? <CallScreen vendorId={callVendorId} /> : null}
        <div hidden={!onDesk || pathname === "/vendor"}>
          <CustomerHome />
        </div>
        <div hidden={pathname !== "/vendor"}>
          <VendorHome />
        </div>
        {!onDesk && !callVendorId ? children : null}
      </main>
    </div>
  );
}

function NoticeBell() {
  const notices = useVaani((s) => s.notices);
  const markNoticesRead = useVaani((s) => s.markNoticesRead);
  const role = useVaani((s) => s.role);
  const { t } = useT();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const visible = notices.filter((n) => !("audience" in n) || n.audience === role);
  const unread = visible.filter((n) => !n.read).length;

  return (
    <div className="relative">
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="relative size-9"
        aria-label={t("notifications")}
        onClick={() => {
          unlockBeep();
          setOpen((v) => !v);
          if (!open) markNoticesRead();
        }}
      >
        <Bell className="size-4" />
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-medium text-accent-fg">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </Button>
      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-80 overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface shadow-lg">
          <p className="border-b border-line px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted">
            {t("notifications")}
          </p>
          {visible.length === 0 ? (
            <p className="px-3 py-6 text-sm text-muted">{t("noEvents")}</p>
          ) : (
            <ul className="max-h-80 overflow-auto">
              {visible.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-accent-soft"
                    onClick={() => {
                      setOpen(false);
                      void navigate({
                        to: "/ticket/$ticketId",
                        params: { ticketId: n.ticketId },
                      });
                      if (role === "vendor") {
                        /* stay vendor */
                      }
                    }}
                  >
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-muted">{n.body}</p>
                    <p className="text-[10px] text-subtle">
                      {new Date(n.at).toLocaleTimeString(useVaani.getState().language || "en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

function SignedInPhone({ phone, shop }: { phone: string; shop: string }) {
  const { t } = useT();
  const ten = phoneDigits(phone);
  if (ten.length !== 10) {
    return <span className="max-w-[9rem] truncate text-xs text-muted">{shop || t("signedIn")}</span>;
  }
  return (
    <span className="inline-flex max-w-[14rem] items-center">
      <span className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs">
        {shop ? <span className="mr-1.5 text-muted">{shop}</span> : null}
        <span className="font-medium">{formatInPhone(ten)}</span>
      </span>
    </span>
  );
}

function AccountBar() {
  const [busy, setBusy] = useState(false);
  const { t } = useT();
  function leave() {
    setBusy(true);
    writeAccountBackup();
    try {
      sessionStorage.removeItem("vaani-session-ok");
    } catch {
      /* ignore */
    }
    storeBearerToken(null);
    resetLoginGate();
    setBusy(false);
  }
  return (
    <div className="flex items-center gap-2">
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={leave}>
        {busy ? t("signingOut") : t("signOut")}
      </Button>
    </div>
  );
}

export { StatusPill } from "@/components/status-pill";
