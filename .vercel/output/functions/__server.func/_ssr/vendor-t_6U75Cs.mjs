import { o as __toESM } from "../_runtime.mjs";
import { B as require_react, _ as Link, b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as INDUSTRY_LABEL } from "./seed-CNZW8z6S.mjs";
import { s as Inbox } from "../_libs/lucide-react.mjs";
import { u as openVendorInbox } from "./login-screen-Ddp81uGG.mjs";
import { a as useVaani, i as readShopIdentity, n as StatusPill, t as AppShell } from "./app-shell-C9DEuo4Y.mjs";
import { t as ShopCard } from "./shop-card-Te2atqWQ.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/vendor-t_6U75Cs.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function VendorHome() {
	const incoming = useVaani((s) => s.incoming);
	const customerName = useVaani((s) => s.customerName);
	const customerPhone = useVaani((s) => s.customerPhone);
	const industry = useVaani((s) => s.industry);
	const isVendor = useVaani((s) => s.isVendor);
	const setRole = useVaani((s) => s.setRole);
	const setClaimedVendor = useVaani((s) => s.setClaimedVendor);
	const replaceIncoming = useVaani((s) => s.replaceIncoming);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [err, setErr] = (0, import_react.useState)(null);
	const opened = (0, import_react.useRef)("");
	const snap = readShopIdentity();
	const shopName = snap?.shopName || customerName;
	const shopIndustry = snap?.industry || industry;
	const listed = snap?.isVendor ?? isVendor;
	(0, import_react.useEffect)(() => {
		setRole("vendor");
	}, [setRole]);
	(0, import_react.useEffect)(() => {
		if (!shopIndustry) return;
		const key = `${shopIndustry}:${listed ? "1" : "0"}`;
		if (opened.current === key) return;
		opened.current = key;
		setBusy(true);
		setErr(null);
		openVendorInbox({ data: {
			industry: shopIndustry,
			phone: customerPhone
		} }).then((res) => {
			if (!res.ok) {
				setErr(res.error);
				replaceIncoming([]);
				return;
			}
			setClaimedVendor(res.vendorId);
			replaceIncoming(res.tickets);
		}).catch(() => setErr("Could not load incoming lists.")).finally(() => setBusy(false));
	}, [
		shopIndustry,
		listed,
		customerPhone,
		replaceIncoming,
		setClaimedVendor
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mb-6 grid gap-6 md:grid-cols-[1.2fr_0.8fr]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs font-medium uppercase tracking-[0.16em] text-muted",
				children: "Vendor desk"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "mt-1 font-display text-4xl tracking-tight",
				children: shopName || "Your shop"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-2 text-sm text-muted",
				children: [shopIndustry ? INDUSTRY_LABEL[shopIndustry] : "Pick your trade in shop details", customerPhone ? ` · ${customerPhone}` : ""]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 max-w-prose text-sm text-muted",
				children: "You are identified by this shop name, mobile, and trade — not another login. Other buyers who have your number send lists here."
			})
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShopCard, {})]
	}), !shopName || !shopIndustry || !listed ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-[var(--radius-xl)] border border-dashed border-line-strong bg-surface px-6 py-12 text-center",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "font-medium",
			children: "List yourself as a vendor"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-1 text-sm text-muted",
			children: "Save shop name, pick your industry, and tick “I sell on Vaani”. That is how buyers know which trade you serve."
		})]
	}) : incoming.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-[var(--radius-xl)] border border-dashed border-line-strong bg-surface px-6 py-16 text-center",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Inbox, { className: "mx-auto size-8 text-subtle" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 font-medium",
				children: busy ? "Loading incoming lists…" : "No incoming lists"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-1 text-sm text-muted",
				children: [
					"Other buyers' ",
					INDUSTRY_LABEL[shopIndustry],
					" orders for ",
					shopName,
					" land here."
				]
			}),
			err ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-danger",
				children: err
			}) : null
		]
	}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		className: "space-y-2",
		children: incoming.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
			className: "flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-line bg-surface px-4 py-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
				to: "/ticket/$ticketId",
				params: { ticketId: t.id },
				className: "min-w-0 flex-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-medium",
					children: t.customerName || "Customer"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "truncate text-xs text-muted",
					children: [
						t.lines.length,
						" lines · ",
						t.customerPhone
					]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex shrink-0 items-center gap-2",
				children: [t.status === "finalized" || t.orderCopy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/copy/$ticketId",
					params: { ticketId: t.id },
					className: "text-xs font-medium text-accent",
					children: "Copy"
				}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusPill, { status: t.status })]
			})]
		}, t.id))
	})] });
}
//#endregion
export { VendorHome as component };
