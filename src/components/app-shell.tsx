import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, Phone, Store } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CustomerHome } from "@/components/customer-home";
import { resetLoginGate, isSignedOut } from "@/components/login-screen";
import { VendorHome } from "@/components/vendor-home";
import { CallScreen } from "@/routes/call.$vendorId";
import { Button } from "@/components/ui/button";
import { storeBearerToken } from "@/lib/auth/client";
import { fireReminderPush, listInboxNotices, listPublicVendors, listRemindersRemote, processDueReminders, saveReminder } from "@/lib/vaani/account";
import { cn } from "@/lib/cn";
import { unlockBeep, playBeep, diffTicketEvents } from "@/lib/vaani/notify";
import { enablePush, showLocalPopup } from "@/lib/vaani/push-client";
import {
  isReminderDue,
  listReminders,
  markBellSeen,
  markFired,
  mergeReminders,
  reminderNeedsBell,
  reminderTargets,
  upsertReminder,
} from "@/lib/vaani/reminders";
import type { Industry, Reminder, Ticket } from "@/lib/vaani/types";
import {
  mergeTicketLists,
  readAccountBackup,
  liveLoginTen,
  readLoginTen,
  readUiLanguage,
  rememberLoginTen,
  restoreLocalAccount,
  applyDirContacts,
  bookNameFor,
  directoryRows,
  readBookNames,
  listedVendors,
  vendorFromListing,
  rememberListedVendor,
  rememberListedBuyer,
  forgetListedVendor,
  readShopIdentity,
  tenFromEmail,
  useVaani,
  writeAccountBackup,
  writeShopIdentity,
  writeUiLanguage,
} from "@/lib/vaani/store";
import { LANGUAGES, formatInPhone, phoneDigits } from "@/lib/vaani/seed";
import { isRtl, useT } from "@/lib/vaani/i18n";

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
  const selling = Boolean(readShopIdentity(liveLoginTen() || readLoginTen())?.isVendor ?? useVaani((s) => s.isVendor));
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
    if (isSignedOut()) {
      useVaani.getState().setHydrated(true);
      useVaani.getState().setAccountReady(true);
      return;
    }
    if (ten.length === 10) {
      rememberLoginTen(ten);
      restoreLocalAccount(ten);
      applyDirContacts();
    }
    useVaani.getState().setHydrated(true);
    useVaani.getState().setAccountReady(true);
  }, [seedPhone]);

  useEffect(() => {
    const loadShops = () => {
      void listPublicVendors()
        .then((rows) => {
          if (!Array.isArray(rows) || isSignedOut()) return;
          const live = [];
          for (const r of rows) {
            if (!r.shopName || r.ten.length !== 10) continue;
            if (r.isVendor) {
              rememberListedVendor({ shopName: r.shopName, phone: r.ten, industry: r.industry || "" });
              live.push(vendorFromListing(r.ten, r.shopName, r.industry || ""));
            } else {
              forgetListedVendor(r.ten);
              rememberListedBuyer({ shopName: r.shopName, phone: r.ten });
            }
          }
          setLiveVendors(live);
        })
        .catch(() => {
          /* local listings */
        });
    };
    loadShops();
    const id = window.setInterval(loadShops, 8000);
    return () => window.clearInterval(id);
  }, [setLiveVendors]);

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
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
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
    if (pathname === "/vendor") {
      if (!selling) {
        setRole("customer");
        void navigate({ to: "/" });
        return;
      }
      setRole("vendor");
    } else if (pathname === "/") setRole("customer");
  }, [pathname, setRole, selling, navigate]);

  useEffect(() => {
    const lang = language || "en-IN";
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtl(lang) ? "rtl" : "ltr";
  }, [language]);

  useEffect(() => {
    const me = liveLoginTen() || readLoginTen();
    const all = [...tickets, ...incoming];
    const events = diffTicketEvents(prevAll.current, all).filter((e) => {
      const ticket = all.find((row) => row.id === e.ticketId);
      if (!ticket || me.length !== 10) return false;
      const buyer = phoneDigits(ticket.customerPhone);
      const vendorTen = phoneDigits(ticket.vendorPhone || "") || String(ticket.vendorId).match(/(\d{10})/)?.[1] || "";
      if (vendorTen === me && e.audience === "customer") return false;
      if (buyer === me && e.audience === "vendor") return false;
      if (e.audience === "vendor") return selling && vendorTen === me && buyer !== me;
      if (e.audience === "customer") return buyer === me && vendorTen !== me;
      return false;
    });
    prevAll.current = all;
    if (!events.length) return;
    pushNotices(events);
    playBeep();
    for (const e of events) void showLocalPopup(e.title, e.body);
  }, [tickets, incoming, pushNotices]);

  useEffect(() => {
    const me = liveLoginTen() || readLoginTen() || phoneDigits(customerPhone);
    if (me.length !== 10) return;
    let stop = false;
    async function tick() {
      if (stop || isSignedOut()) return;
      try {
        if (isSignedOut()) return;
        const login = liveLoginTen() || readLoginTen() || phoneDigits(useVaani.getState().customerPhone) || me;
        const remoteRaw = await listRemindersRemote({ data: { phone: login } });
        if (stop || isSignedOut()) return;
        const remote = Array.isArray(remoteRaw)
          ? remoteRaw
          : remoteRaw && typeof remoteRaw === "object" && Array.isArray((remoteRaw as { result?: unknown }).result)
            ? ((remoteRaw as { result: Reminder[] }).result)
            : [];
        if (remote.length) mergeReminders(remote as Reminder[]);
      } catch {
        /* local reminders */
      }
      const loginEarly = liveLoginTen() || readLoginTen() || phoneDigits(useVaani.getState().customerPhone) || me;
      const dueNowIds = new Set(
        listReminders()
          .filter((r) => reminderTargets(r).includes(loginEarly) && isReminderDue(r))
          .map((r) => r.id),
      );
      try {
        const login = liveLoginTen() || readLoginTen() || phoneDigits(useVaani.getState().customerPhone) || me;
        await processDueReminders({ data: { phone: login, book: readBookNames() } });
        const again = await listRemindersRemote({ data: { phone: login } });
        const againRows = Array.isArray(again)
          ? again
          : again && typeof again === "object" && Array.isArray((again as { result?: unknown }).result)
            ? ((again as { result: Reminder[] }).result)
            : [];
        if (againRows.length) mergeReminders(againRows as Reminder[]);
      } catch {
        /* server due optional */
      }
      const login = liveLoginTen() || readLoginTen() || phoneDigits(useVaani.getState().customerPhone) || me;
      const today = new Date().toLocaleString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 10);
      const latestByPair = new Map<string, Reminder>();
      for (const r of listReminders()) {
        const key = `${phoneDigits(r.ownerTen)}:${phoneDigits(r.contactTen)}`;
        const prev = latestByPair.get(key);
        if (!prev || String(r.createdAt || "") > String(prev.createdAt || "")) latestByPair.set(key, r);
      }
      for (const r of latestByPair.values()) {
        const targets = reminderTargets(r);
        if (!targets.includes(login)) continue;
        const owner = phoneDigits(r.ownerTen);
        const contact = phoneDigits(r.contactTen);
        const isContact = Boolean(r.notifyBoth) && login === contact;
        const dueNow = isReminderDue(r) || dueNowIds.has(r.id) || (isContact && (r.lastFired || "") === today);
        if (!dueNow) continue;
        const nid = `bell-${owner}-${contact}-${login}-${today}`;
        let firstBell = true;
        try {
          firstBell = localStorage.getItem(nid) !== "1";
          if (firstBell) localStorage.setItem(nid, "1");
        } catch {
          firstBell = true;
        }
        if (!firstBell) continue;
        if (useVaani.getState().notices.some((n) => n.id === nid || n.id.startsWith(`due-${r.id}-`))) continue;
        const other = login === owner ? contact : owner;
        const label = bookNameFor(other, r.contactName) || r.contactName || "Reminder";
        pushNotices([
          {
            id: nid,
            at: new Date().toISOString(),
            title: label,
            body: r.message || label,
            ticketId: `reminder:${r.id}`,
            read: false,
            audience: useVaani.getState().role,
          },
        ]);
        playBeep();
      }
    }
    void tick();
    const id = window.setInterval(() => void tick(), 3000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [pushNotices, customerPhone]);

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <header className="no-print sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur-sm pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-[max(1rem,env(safe-area-inset-right))] py-3 pl-[max(1rem,env(safe-area-inset-left))]">
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
                onClick={(e) => {
                  if (!selling) {
                    e.preventDefault();
                    window.alert(t("vendorBlocked"));
                    return;
                  }
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
            <SignedInPhone phone={isSignedOut() ? "" : formatInPhone(liveLoginTen() || readLoginTen() || customerPhone)} />
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
  const tickets = useVaani((s) => s.tickets);
  const incoming = useVaani((s) => s.incoming);
  const { t } = useT();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLSpanElement>(null);
  const [box, setBox] = useState({ top: 0, left: 12, width: 288 });
  const me = liveLoginTen() || readLoginTen();
  const selling = Boolean(readShopIdentity(me)?.isVendor ?? useVaani((s) => s.isVendor));
  const visible = notices.filter((n) => {
    if (String(n.ticketId || "").startsWith("reminder") || String(n.id || "").startsWith("rem-") || String(n.id || "").startsWith("push-") || String(n.id || "").startsWith("due-")) return true;
    const ticket = tickets.find((row) => row.id === n.ticketId) || incoming.find((row) => row.id === n.ticketId);
    if (!ticket || me.length !== 10) return false;
    const buyer = phoneDigits(ticket.customerPhone);
    const vendorTen = phoneDigits(ticket.vendorPhone || "") || String(ticket.vendorId).match(/(\d{10})/)?.[1] || "";
    if (n.audience === "vendor") return selling && vendorTen === me && buyer !== me;
    if (n.audience === "customer") return buyer === me && vendorTen !== me;
    return false;
  });
  const unread = visible.filter((n) => !n.read).length;

  function placeBox() {
    const r = btnRef.current?.getBoundingClientRect();
    const width = Math.min(288, Math.max(220, window.innerWidth - 24));
    let left = (r?.left ?? 12);
    if (left + width > window.innerWidth - 12) left = window.innerWidth - width - 12;
    if (left < 12) left = 12;
    setBox({ top: (r?.bottom ?? 56) + 8, left, width });
  }

  return (
    <div className="relative">
      <span ref={btnRef} className="relative inline-flex">
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="relative size-9"
        aria-label={t("notifications")}
        onClick={() => {
          unlockBeep();
          setOpen((v) => {
            const next = !v;
            if (next) placeBox();
            return next;
          });
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
      </span>
      {open && typeof document !== "undefined"
        ? createPortal(
        <div
          className="fixed z-[80] overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface shadow-lg"
          style={{
            top: box.top,
            left: 12,
            width: "calc(100vw - 24px)",
            maxHeight: "min(16rem, 45dvh)",
          }}
        >
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
                      if (n.ticketId.startsWith("reminder:")) return;
                      void navigate({
                        to: "/ticket/$ticketId",
                        params: { ticketId: n.ticketId },
                      });
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
        </div>,
            document.body,
          )
        : null}
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
  const { t } = useT();
  function leave() {
    resetLoginGate();
    try {
      sessionStorage.removeItem("vaani-session-ok");
    } catch {
      /* ignore */
    }
    storeBearerToken(null);
    window.dispatchEvent(new Event("vaani-auth"));
  }
  return (
    <div className="flex items-center gap-2">
      <Button type="button" size="sm" variant="outline" onClick={leave}>
        {t("signOut")}
      </Button>
    </div>
  );
}

export { StatusPill } from "@/components/status-pill";
