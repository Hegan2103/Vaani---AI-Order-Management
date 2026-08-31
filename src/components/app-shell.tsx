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
import { unlockBeep, playBeep, diffTicketEvents } from "@/lib/vaani/notify";
import { enablePush, showLocalPopup } from "@/lib/vaani/push-client";
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
  const tickets = useVaani((s) => s.tickets);
  const incoming = useVaani((s) => s.incoming);
  const prevFp = useRef("");
  const prevAll = useRef<Ticket[]>([]);
  const restoredFor = useRef("");
  const pushAsked = useRef(false);

  useLayoutEffect(() => {
    const bar = document.getElementById("vaani-cred-bar");
    if (bar) {
      bar.textContent = "";
      bar.style.display = "none";
    }
    const ten = liveLoginTen() || readLoginTen() || phoneDigits(seedPhone || "") || phoneDigits(useVaani.getState().customerPhone);
    if (ten.length === 10) {
      rememberLoginTen(ten);
      restoreLocalAccount(ten);
      applyDirContacts();
    }
    useVaani.getState().setHydrated(true);
    useVaani.getState().setAccountReady(true);
  }, [seedPhone]);

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
    const arm = () => {
      unlockBeep();
      if (!pushAsked.current) {
        pushAsked.current = true;
        const ten = liveLoginTen() || readLoginTen();
        if (ten.length === 10) void enablePush(ten);
      }
    };
    window.addEventListener("pointerdown", arm);
    return () => {
      window.removeEventListener("pagehide", dump);
      window.removeEventListener("pointerdown", arm);
    };
  }, []);

  useEffect(() => {
    if (pathname === "/vendor") setRole("vendor");
    else if (pathname === "/") setRole("customer");
  }, [pathname, setRole]);

  useEffect(() => {
    const lang = language || "en-IN";
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtl(lang) ? "rtl" : "ltr";
  }, [language]);

  useEffect(() => {
    const me = liveLoginTen() || readLoginTen() || phoneDigits(customerPhone);
    const all = [...tickets, ...incoming];
    const events = diffTicketEvents(prevAll.current, all).filter((e) => {
      const ticket = all.find((row) => row.id === e.ticketId);
      if (!ticket || !me) return false;
      const buyer = phoneDigits(ticket.customerPhone);
      const vendorTen = phoneDigits(ticket.vendorPhone || "") || String(ticket.vendorId).match(/(\d{10})/)?.[1] || "";
      if (e.audience === "vendor") return vendorTen === me && buyer !== me;
      if (e.audience === "customer") return buyer === me && vendorTen !== me;
      return false;
    });
    prevAll.current = all;
    if (!events.length) return;
    pushNotices(events);
    playBeep();
    for (const e of events) showLocalPopup(e.title, e.body);
  }, [tickets, incoming, pushNotices, customerPhone]);

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <header className="no-print sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
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
            <SignedInPhone phone={formatInPhone(liveLoginTen() || readLoginTen() || customerPhone)} />
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

function SignedInPhone({ phone }: { phone: string }) {
  const { t } = useT();
  const ten = phoneDigits(phone);
  if (ten.length !== 10) {
    return <span className="text-xs text-muted">{t("signedIn")}</span>;
  }
  return (
    <span className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium">
      {formatInPhone(ten)}
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
