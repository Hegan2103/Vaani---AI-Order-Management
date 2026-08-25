import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, Phone, Store } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { resetLoginGate } from "@/components/login-screen";
import { Button } from "@/components/ui/button";
import { authClient, signOut, storeBearerToken } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/cn";
import { listIncomingTickets, listRegisteredVendors, listTickets, loadAccount, saveLanguage, saveProfile, saveTicket } from "@/lib/vaani/account";
import { diffTicketEvents, playBeep, ticketFingerprint, unlockBeep } from "@/lib/vaani/notify";
import { LANGUAGES, formatInPhone, inboxIdForUser, phoneDigits } from "@/lib/vaani/seed";
import {
  mergeTicketLists,
  readAccountBackup,
  readLoginTen,
  rememberLoginTen,
  restoreLocalAccount,
  readShopIdentity,
  tenFromEmail,
  useVaani,
  writeAccountBackup,
  writeShopIdentity,
} from "@/lib/vaani/store";
import type { Industry, Ticket } from "@/lib/vaani/types";

export function AppShell({ children }: { children: ReactNode }) {
  const role = useVaani((s) => s.role);
  const setRole = useVaani((s) => s.setRole);
  const setShopIdentity = useVaani((s) => s.setShopIdentity);
  const setLanguage = useVaani((s) => s.setLanguage);
  const language = useVaani((s) => s.language);
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
  const hydrated = useVaani((s) => s.hydrated);
  const accountReady = useVaani((s) => s.accountReady);
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const userId = user?.id ?? "";
  const userEmail = user?.primaryEmail ?? "";
  const userName = user?.displayName ?? "";
  const prevFp = useRef("");
  const prevAll = useRef<Ticket[]>([]);
  const restoredFor = useRef("");

  useEffect(() => {
    void Promise.resolve(useVaani.persist.rehydrate()).then(() => {
      const s = useVaani.getState();
      s.setHydrated(true);
      restoreLocalAccount(readLoginTen() || s.customerPhone);
      if (s.customerName.trim() || s.tickets.length || s.incoming.length) {
        s.setAccountReady(true);
        writeAccountBackup();
      }
      if (s.customerName.trim() && !readShopIdentity()) {
        writeShopIdentity({
          shopName: s.customerName,
          phone: s.customerPhone,
          industry: s.industry,
          isVendor: s.isVendor,
          language: s.language || "hi-IN",
        });
        s.setShopIdentity({
          shopName: s.customerName,
          phone: s.customerPhone,
          industry: s.industry,
          isVendor: s.isVendor,
          language: s.language || "hi-IN",
        });
      }
    });
  }, []);

  useEffect(() => {
    const ten = tenFromEmail(userEmail) || phoneDigits(userName) || readLoginTen();
    if (ten.length !== 10) return;
    rememberLoginTen(ten);
    restoreLocalAccount(ten);
    const formatted = formatInPhone(ten);
    const s = useVaani.getState();
    if (phoneDigits(s.customerPhone) !== ten) {
      useVaani.setState({ customerPhone: formatted });
      const snap = readShopIdentity();
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
        language: backup.language || "hi-IN",
      });
    }
    if (backup?.tickets?.length) replaceTickets(backup.tickets);
    if (backup?.incoming?.length) replaceIncoming(backup.incoming);
    if (backup?.claimedVendorId) setClaimedVendor(backup.claimedVendorId);
    if (backup?.shopName?.trim() || backup?.tickets?.length || backup?.incoming?.length) {
      setAccountReady(true);
    }
    if (alreadyFetched || !userId) return;
    try {
      localStorage.setItem("vaani-restored", restoreKey);
    } catch {
      /* ignore */
    }
    resetForUser(userId);
    restoreLocalAccount(ten);
    window.setTimeout(() => {
      void loadAccount({ data: { phone: ten } })
      .then(async (account) => {
        const local = useVaani.getState();
        const localTen = phoneDigits(local.customerPhone);
        const samePerson = !localTen || !ten || localTen === ten;
        const p = account.profile;
        const serverShop = p?.shop_name?.trim() ?? "";
        const localShop = samePerson ? local.customerName.trim() : "";
        const shopName = serverShop || localShop || backup?.shopName || "";
        const phone = formatInPhone(
          p?.phone || (samePerson ? local.customerPhone : "") || ten || backup?.phone || "",
        );
        const industry =
          ((p?.industry || (samePerson ? local.industry : "") || backup?.industry || "") as Industry | "") || "";
        const isVendor = Boolean(p?.is_vendor || (samePerson && local.isVendor) || backup?.isVendor);
        const language = p?.language || (samePerson ? local.language : "") || backup?.language || "hi-IN";
        if (shopName) {
          setShopIdentity({
            shopName,
            phone,
            industry,
            isVendor,
            language,
          });
        } else if (p?.language) {
          setLanguage(p.language);
        }
        if (p?.vendor_id) setClaimedVendor(p.vendor_id);
        else if (p?.is_vendor) setClaimedVendor(inboxIdForUser(userId));
        const tickets = mergeTicketLists(samePerson ? local.tickets : [], account.tickets);
        const incoming = mergeTicketLists(samePerson ? local.incoming : [], account.incoming);
        replaceTickets(tickets);
        replaceIncoming(incoming);
        setAccountReady(true);
        useVaani.setState({ accountUserId: userId });
        const all = [...incoming, ...tickets];
        prevAll.current = all;
        prevFp.current = ticketFingerprint(all);
        if (serverShop === "" && shopName) {
          void saveProfile({
            data: {
              shopName,
              phone,
              role: isVendor ? "vendor" : "customer",
              industry,
              isVendor,
              language,
            },
          }).catch(() => undefined);
        }
        if (account.tickets.length === 0 && tickets.length) {
          await Promise.all(tickets.map((t) => saveTicket({ data: { ticket: t } }).catch(() => undefined)));
        }
        if (account.incoming.length === 0 && incoming.length) {
          await Promise.all(incoming.map((t) => saveTicket({ data: { ticket: t } }).catch(() => undefined)));
        }
        writeAccountBackup();
      })
      .catch(() => {
        const local = useVaani.getState();
        if (local.customerName.trim()) {
          setShopIdentity({
            shopName: local.customerName,
            phone: local.customerPhone,
            industry: local.industry,
            isVendor: local.isVendor,
            language: local.language || "hi-IN",
          });
        }
        setAccountReady(true);
        restoredFor.current = "";
      });
      void listRegisteredVendors()
        .then((rows) => setLiveVendors(rows))
        .catch(() => undefined);
    }, 0);
  }, [isPending, userId, userEmail, hydrated]);

  useEffect(() => {
    if (isPending || !userId || !hydrated || !accountReady) return;
    const uid = userId;
    let alive = true;
    async function refresh() {
      try {
        const vendorKey = claimedVendorId || inboxIdForUser(uid);
        const [mine, incoming] = await Promise.all([
          listTickets(),
          listIncomingTickets({ data: { vendorId: vendorKey } }),
        ]);
        if (!alive) return;
        const all = mergeTicketLists(incoming, mine);
        const fp = ticketFingerprint(all);
        if (prevFp.current && fp !== prevFp.current) {
          const roleNow = useVaani.getState().role;
          const events = diffTicketEvents(prevAll.current, all).filter((e) => e.audience === roleNow);
          if (events.length) {
            pushNotices(events);
            playBeep();
          }
        }
        prevFp.current = fp;
        prevAll.current = all;
        const local = useVaani.getState();
        replaceTickets(mergeTicketLists(local.tickets, mine));
        replaceIncoming(mergeTicketLists(local.incoming, incoming));
      } catch {
        /* keep last snapshot */
      }
    }
    void refresh();
    const id = window.setInterval(() => void refresh(), 5000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [isPending, userId, claimedVendorId, hydrated, accountReady, replaceTickets, replaceIncoming, pushNotices]);

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <header className="no-print sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="font-display text-xl tracking-tight">Vaani</span>
            <span className="hidden text-xs text-muted sm:inline">Voice orders</span>
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-[var(--radius-lg)] border border-line bg-surface p-1">
              <Link
                to="/"
                onClick={() => setRole("customer")}
                className={cn(
                  "inline-flex h-8 items-center gap-1 rounded-full px-3 text-sm font-medium",
                  role === "customer" ? "bg-accent text-accent-fg" : "text-muted",
                )}
              >
                <Phone className="size-3.5" />
                Customer
              </Link>
              <Link
                to="/vendor"
                onClick={() => setRole("vendor")}
                className={cn(
                  "inline-flex h-8 items-center gap-1 rounded-full px-3 text-sm font-medium",
                  role === "vendor" ? "bg-accent text-accent-fg" : "text-muted",
                )}
              >
                <Store className="size-3.5" />
                Vendor
              </Link>
            </div>
            <select
              aria-label="Language"
              value={language || "hi-IN"}
              onChange={(e) => {
                const next = e.target.value;
                setLanguage(next);
                void saveLanguage({ data: { language: next } }).catch(() => undefined);
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
              phone={customerPhone || tenFromEmail(user?.primaryEmail) || user?.displayName || readLoginTen()}
              shop={customerName}
            />
            <AccountBar />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}

function NoticeBell() {
  const notices = useVaani((s) => s.notices);
  const markNoticesRead = useVaani((s) => s.markNoticesRead);
  const role = useVaani((s) => s.role);
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
        aria-label="Notifications"
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
            Notifications
          </p>
          {visible.length === 0 ? (
            <p className="px-3 py-6 text-sm text-muted">No events yet.</p>
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
                      {new Date(n.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
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
  const ten = phoneDigits(phone);
  if (ten.length !== 10) {
    return <span className="max-w-[9rem] truncate text-xs text-muted">{shop || "Signed in"}</span>;
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
  async function leave() {
    setBusy(true);
    writeAccountBackup();
    try {
      localStorage.removeItem("vaani-bearer-v1");
      sessionStorage.removeItem("vaani-session-ok");
      resetLoginGate();
    } catch {
      /* ignore */
    }
    try {
      await Promise.race([
        signOut("/login"),
        new Promise((_, reject) => {
          window.setTimeout(() => reject(new Error("timeout")), 3500);
        }),
      ]);
    } catch {
      try {
        await authClient.signOut();
      } catch {
        /* local clear is enough */
      }
      window.location.replace("/login");
    }
  }
  return (
    <div className="flex items-center gap-2">
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void leave()}>
        {busy ? "Signing out…" : "Sign out"}
      </Button>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "text-warn border-line",
    sent: "text-accent border-line",
    reviewing: "text-accent border-line",
    quoted: "text-accent border-line",
    accepted: "text-ok border-line",
    confirmed: "text-ok border-line",
    finalized: "text-ok border-line",
    delivered: "text-ok border-line",
    rejected: "text-danger border-line",
    order: "text-ink border-line",
    inquiry: "text-muted border-line",
    draft: "text-muted border-line",
  };
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-full border bg-surface px-2.5 text-[11px] font-medium uppercase tracking-wide",
        map[status] ?? "text-muted border-line",
      )}
    >
      {status}
    </span>
  );
}
