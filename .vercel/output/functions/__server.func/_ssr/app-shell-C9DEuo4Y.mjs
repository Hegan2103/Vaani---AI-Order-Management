import { o as __toESM } from "../_runtime.mjs";
import { B as require_react, _ as Link, b as require_jsx_runtime, v as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as VENDORS, c as phoneDigits, l as phonesMatch, r as LANGUAGES, t as DEFAULT_CONTACTS } from "./seed-CNZW8z6S.mjs";
import { i as Phone, n as Store } from "../_libs/lucide-react.mjs";
import { i as signOut, t as authClient } from "./client-B40BzJxt.mjs";
import { c as listTickets, d as saveLanguage, l as loadProfile, n as LoginScreen, o as listIncomingTickets, r as cn, s as listRegisteredVendors, t as Button } from "./login-screen-Ddp81uGG.mjs";
import { n as create, t as persist } from "../_libs/zustand.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/app-shell-C9DEuo4Y.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* Current user + loading state. Same behavior in live preview and when deployed:
*   - Auth enabled -> the real signed-in user; `user` is `null` while
*                            the session resolves (`isPending: true`) and when
*                            signed out (`isPending: false`). Session comes from
*                            Better Auth `useSession()` → `/api/auth/get-session`
*                            (cookie when deployed; bearer in live preview).
*   - Auth disabled (`VITE_AUTH_ENABLED=false`) -> `DEV_USER`, never pending.
*
* Protect a route by waiting out `isPending` before acting on `user` —
* redirecting on `user: null` alone bounces signed-in visitors to sign-in on
* every hard reload:
*
*   import { RedirectToSignIn } from "@/lib/auth/gates";
*   const { user, isPending } = useCurrentUserState();
*   if (isPending) return null;              // still resolving — don't redirect yet
*   if (!user) return <RedirectToSignIn />;  // definitely signed out
*
* `authEnabled` is a module-level constant fixed at load, so the guarded hook
* call keeps a stable hook order across every render of a given component.
*/
function useCurrentUserState() {
	const { data, isPending } = authClient.useSession();
	const user = data?.user;
	return {
		user: user ? {
			id: user.id,
			displayName: user.name ?? null,
			primaryEmail: user.email ?? null,
			profileImageUrl: user.image ?? null,
			isDevFallback: false
		} : null,
		isPending
	};
}
var LAST_TICKET_KEY = "vaani-last-ticket";
var SHOP_KEY = "vaani-shop-identity-v1";
function readShopIdentity() {
	if (typeof window === "undefined") return null;
	try {
		const raw = sessionStorage.getItem(SHOP_KEY) || localStorage.getItem(SHOP_KEY);
		if (!raw) return null;
		const p = JSON.parse(raw);
		if (!p.shopName?.trim()) return null;
		return p;
	} catch {
		return null;
	}
}
function writeShopIdentity(p) {
	if (typeof window === "undefined") return;
	try {
		const raw = JSON.stringify(p);
		sessionStorage.setItem(SHOP_KEY, raw);
		localStorage.setItem(SHOP_KEY, raw);
	} catch {}
}
function vendorById(id) {
	const seed = VENDORS.find((v) => v.id === id);
	if (seed) return seed;
	try {
		return useVaani.getState().liveVendors.find((v) => v.id === id);
	} catch {
		return;
	}
}
function vendorForPhone(phone) {
	const seed = VENDORS.find((v) => phonesMatch(v.phone, phone));
	if (seed) return seed;
	try {
		return useVaani.getState().liveVendors.find((v) => phonesMatch(v.phone, phone) || (v.altPhones ?? []).some((p) => phonesMatch(p, phone)));
	} catch {
		return;
	}
}
function relink(contacts, live) {
	const all = [...VENDORS, ...live];
	return contacts.map((c) => {
		const hit = all.find((v) => phonesMatch(v.phone, c.phone) || (v.altPhones ?? []).some((p) => phonesMatch(p, c.phone)));
		return hit ? {
			...c,
			vendorId: hit.id
		} : c;
	});
}
function readLastTicket() {
	if (typeof window === "undefined") return null;
	try {
		const raw = sessionStorage.getItem(LAST_TICKET_KEY);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}
function writeLastTicket(ticket) {
	try {
		sessionStorage.setItem(LAST_TICKET_KEY, JSON.stringify(ticket));
	} catch {}
}
function patchList(list, ticketId, fn) {
	return list.map((t) => t.id === ticketId ? fn(t) : t);
}
var useVaani = create()(persist((set) => ({
	role: "customer",
	customerName: "",
	customerPhone: "",
	industry: "",
	isVendor: false,
	language: "hi-IN",
	shopSaved: false,
	claimedVendorId: "",
	liveVendors: [],
	contacts: DEFAULT_CONTACTS,
	tickets: [],
	incoming: [],
	hydrated: false,
	setHydrated: (hydrated) => set({ hydrated }),
	setRole: (role) => set({ role }),
	setProfile: (customerName, customerPhone) => set((s) => {
		const name = customerName.trim() || s.customerName;
		return {
			customerName: name,
			customerPhone: customerPhone.trim() || s.customerPhone,
			shopSaved: s.shopSaved || name.length > 0
		};
	}),
	setShopIdentity: (p) => {
		writeShopIdentity({
			...p,
			language: p.language || "hi-IN"
		});
		set({
			customerName: p.shopName.trim(),
			customerPhone: p.phone.trim(),
			industry: p.industry,
			isVendor: p.isVendor,
			language: p.language || "hi-IN",
			shopSaved: p.shopName.trim().length > 0
		});
	},
	setLanguage: (language) => set((s) => {
		const next = language || s.language || "hi-IN";
		writeShopIdentity({
			shopName: s.customerName,
			phone: s.customerPhone,
			industry: s.industry,
			isVendor: s.isVendor,
			language: next
		});
		return { language: next };
	}),
	setClaimedVendor: (claimedVendorId) => set({ claimedVendorId }),
	setLiveVendors: (liveVendors) => set((s) => ({
		liveVendors,
		contacts: relink(s.contacts, liveVendors)
	})),
	mergeContacts: (extra) => set((s) => {
		const byDigits = new Map(s.contacts.map((c) => [phoneDigits(c.phone), c]));
		const next = [...s.contacts];
		for (const c of extra) {
			const key = phoneDigits(c.phone);
			const existing = byDigits.get(key);
			if (!existing) {
				next.push(c);
				byDigits.set(key, c);
			} else if (!existing.vendorId && c.vendorId) {
				const i = next.findIndex((x) => phoneDigits(x.phone) === key);
				if (i >= 0) next[i] = {
					...next[i],
					vendorId: c.vendorId
				};
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
			tickets[i] = ticket;
			return { tickets };
		});
	},
	upsertIncoming: (ticket) => {
		writeLastTicket(ticket);
		set((s) => {
			const i = s.incoming.findIndex((t) => t.id === ticket.id);
			if (i === -1) return { incoming: [ticket, ...s.incoming] };
			const incoming = s.incoming.slice();
			incoming[i] = ticket;
			return { incoming };
		});
	},
	replaceTickets: (tickets) => set({ tickets }),
	replaceIncoming: (incoming) => set({ incoming }),
	updateLines: (ticketId, lines, status) => set((s) => {
		const apply = (t) => ({
			...t,
			lines,
			status: status ?? deriveStatus(lines, t.status)
		});
		const tickets = patchList(s.tickets, ticketId, apply);
		const incoming = patchList(s.incoming, ticketId, apply);
		const current = tickets.find((t) => t.id === ticketId) ?? incoming.find((t) => t.id === ticketId);
		if (current) writeLastTicket(current);
		return {
			tickets,
			incoming
		};
	}),
	setOrderCopy: (ticketId, copy) => set((s) => {
		const apply = (t) => ({
			...t,
			orderCopy: copy,
			status: "finalized"
		});
		const tickets = patchList(s.tickets, ticketId, apply);
		const incoming = patchList(s.incoming, ticketId, apply);
		const current = tickets.find((t) => t.id === ticketId) ?? incoming.find((t) => t.id === ticketId);
		if (current) writeLastTicket(current);
		return {
			tickets,
			incoming
		};
	})
}), {
	name: "vaani-store-v3",
	skipHydration: true,
	merge: (persisted, current) => {
		const p = persisted ?? {};
		const name = (p.customerName || current.customerName || "").trim();
		const phone = (p.customerPhone || current.customerPhone || "").trim();
		return {
			...current,
			...p,
			customerName: name,
			customerPhone: phone,
			industry: p.industry || current.industry || "",
			isVendor: Boolean(p.isVendor || current.isVendor),
			language: p.language || current.language || "hi-IN",
			shopSaved: Boolean(p.shopSaved || current.shopSaved || name)
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
		contacts: s.contacts,
		tickets: s.tickets
	})
}));
function deriveStatus(lines, current) {
	if (lines.length === 0) return current;
	if (!lines.every((l) => l.status !== "pending")) return current === "draft" ? "draft" : "reviewing";
	if (lines.some((l) => l.status === "quoted" || l.status === "accepted")) return "quoted";
	return current;
}
function AppShell({ children }) {
	const role = useVaani((s) => s.role);
	const setRole = useVaani((s) => s.setRole);
	const setShopIdentity = useVaani((s) => s.setShopIdentity);
	const setLanguage = useVaani((s) => s.setLanguage);
	const language = useVaani((s) => s.language);
	const setClaimedVendor = useVaani((s) => s.setClaimedVendor);
	const claimedVendorId = useVaani((s) => s.claimedVendorId);
	const replaceTickets = useVaani((s) => s.replaceTickets);
	const replaceIncoming = useVaani((s) => s.replaceIncoming);
	const setLiveVendors = useVaani((s) => s.setLiveVendors);
	const navigate = useNavigate();
	const { user, isPending } = useCurrentUserState();
	(0, import_react.useEffect)(() => {
		Promise.resolve(useVaani.persist.rehydrate()).then(() => {
			const s = useVaani.getState();
			s.setHydrated(true);
			if (s.customerName.trim() && !readShopIdentity()) {
				writeShopIdentity({
					shopName: s.customerName,
					phone: s.customerPhone,
					industry: s.industry,
					isVendor: s.isVendor,
					language: s.language || "hi-IN"
				});
				s.setShopIdentity({
					shopName: s.customerName,
					phone: s.customerPhone,
					industry: s.industry,
					isVendor: s.isVendor,
					language: s.language || "hi-IN"
				});
			}
		});
	}, []);
	(0, import_react.useEffect)(() => {
		if (isPending || !user) return;
		loadProfile().then((p) => {
			if (!p?.shop_name?.trim()) {
				if (p?.language) setLanguage(p.language);
				return;
			}
			setShopIdentity({
				shopName: p.shop_name,
				phone: p.phone,
				industry: p.industry || "",
				isVendor: Boolean(p.is_vendor),
				language: p.language || "hi-IN"
			});
			if (p.vendor_id) setClaimedVendor(p.vendor_id);
		}).catch(() => void 0);
		listTickets().then((rows) => {
			if (rows.length) replaceTickets(rows);
		}).catch(() => void 0);
		listRegisteredVendors().then((rows) => setLiveVendors(rows)).catch(() => void 0);
	}, [
		isPending,
		user,
		replaceTickets,
		setShopIdentity,
		setClaimedVendor,
		setLiveVendors,
		setLanguage
	]);
	(0, import_react.useEffect)(() => {
		if (isPending || !user || !claimedVendorId) return;
		listIncomingTickets({ data: { vendorId: claimedVendorId } }).then((rows) => replaceIncoming(rows)).catch(() => void 0);
	}, [
		isPending,
		user,
		claimedVendorId,
		replaceIncoming
	]);
	if (isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-dvh bg-bg px-4 py-16 text-ink",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-center font-display text-3xl tracking-tight",
			children: "Vaani"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-2 text-center text-sm text-muted",
			children: "Checking your session…"
		})]
	});
	if (!user) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoginScreen, {});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-dvh bg-bg text-ink",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
			className: "no-print sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur-sm",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/",
					className: "flex items-baseline gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-display text-xl tracking-tight",
						children: "Vaani"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "hidden text-xs text-muted sm:inline",
						children: "Voice orders"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-1 rounded-[var(--radius-lg)] border border-line bg-surface p-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								size: "sm",
								variant: role === "customer" ? "primary" : "ghost",
								className: cn("rounded-full px-3", role !== "customer" && "text-muted"),
								onClick: () => {
									setRole("customer");
									navigate({ to: "/" });
								},
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Phone, { className: "size-3.5" }), "Customer"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								size: "sm",
								variant: role === "vendor" ? "primary" : "ghost",
								className: cn("rounded-full px-3", role !== "vendor" && "text-muted"),
								onClick: () => {
									setRole("vendor");
									navigate({ to: "/vendor" });
								},
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Store, { className: "size-3.5" }), "Vendor"]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
							"aria-label": "Language",
							value: language || "hi-IN",
							onChange: (e) => {
								const next = e.target.value;
								setLanguage(next);
								saveLanguage({ data: { language: next } }).catch(() => void 0);
							},
							className: "h-9 max-w-[9.5rem] rounded-[var(--radius-sm)] border border-line bg-surface px-2 text-xs",
							children: LANGUAGES.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: l.id,
								children: l.label
							}, l.id))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AccountBar, { name: user.displayName ?? user.primaryEmail ?? "Account" })
					]
				})]
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
			className: "mx-auto w-full max-w-5xl px-4 py-6",
			children
		})]
	});
}
function AccountBar({ name }) {
	const [busy, setBusy] = (0, import_react.useState)(false);
	async function leave() {
		setBusy(true);
		try {
			await Promise.race([signOut("/login"), new Promise((_, reject) => {
				window.setTimeout(() => reject(/* @__PURE__ */ new Error("timeout")), 3500);
			})]);
		} catch {
			try {
				await authClient.signOut();
			} catch {}
			window.location.replace("/login");
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "hidden max-w-[7rem] truncate text-xs text-muted sm:inline",
			children: name
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			type: "button",
			size: "sm",
			variant: "outline",
			disabled: busy,
			onClick: () => void leave(),
			children: busy ? "Signing out…" : "Sign out"
		})]
	});
}
function StatusPill({ status }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("inline-flex h-7 items-center rounded-full border bg-surface px-2.5 text-[11px] font-medium uppercase tracking-wide", {
			pending: "text-warn border-line",
			sent: "text-accent border-line",
			reviewing: "text-accent border-line",
			quoted: "text-accent border-line",
			accepted: "text-ok border-line",
			confirmed: "text-ok border-line",
			finalized: "text-ok border-line",
			rejected: "text-danger border-line",
			order: "text-ink border-line",
			inquiry: "text-muted border-line",
			draft: "text-muted border-line"
		}[status] ?? "text-muted border-line"),
		children: status
	});
}
//#endregion
export { useVaani as a, readShopIdentity as i, StatusPill as n, vendorById as o, readLastTicket as r, vendorForPhone as s, AppShell as t };
