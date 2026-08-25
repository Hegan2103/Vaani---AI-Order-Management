import { o as __toESM } from "../_runtime.mjs";
import { B as require_react, b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as INDUSTRY_LABEL, r as LANGUAGES } from "./seed-CNZW8z6S.mjs";
import { a as Pencil } from "../_libs/lucide-react.mjs";
import { f as saveProfile, t as Button } from "./login-screen-Ddp81uGG.mjs";
import { a as useVaani, i as readShopIdentity } from "./app-shell-C9DEuo4Y.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/shop-card-Te2atqWQ.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function ShopCard({ extra }) {
	const role = useVaani((s) => s.role);
	const customerName = useVaani((s) => s.customerName);
	const customerPhone = useVaani((s) => s.customerPhone);
	const industry = useVaani((s) => s.industry);
	const isVendor = useVaani((s) => s.isVendor);
	const language = useVaani((s) => s.language);
	const shopSaved = useVaani((s) => s.shopSaved);
	const setShopIdentity = useVaani((s) => s.setShopIdentity);
	const snap = readShopIdentity();
	const savedName = snap?.shopName || customerName;
	const savedPhone = snap?.phone || customerPhone;
	const savedIndustry = snap?.industry || industry;
	const savedVendor = snap?.isVendor ?? isVendor;
	const savedLang = snap?.language || language || "hi-IN";
	const hasSaved = Boolean(savedName.trim()) && (shopSaved || Boolean(snap));
	const [editing, setEditing] = (0, import_react.useState)(!hasSaved);
	const [shopDraft, setShopDraft] = (0, import_react.useState)(savedName);
	const [phoneDraft, setPhoneDraft] = (0, import_react.useState)(savedPhone);
	const [industryDraft, setIndustryDraft] = (0, import_react.useState)(savedIndustry);
	const [sellDraft, setSellDraft] = (0, import_react.useState)(savedVendor);
	const [langDraft, setLangDraft] = (0, import_react.useState)(savedLang);
	const [shopMsg, setShopMsg] = (0, import_react.useState)(null);
	const [shopBusy, setShopBusy] = (0, import_react.useState)(false);
	const editClicked = (0, import_react.useRef)(false);
	(0, import_react.useEffect)(() => {
		if (hasSaved && !editClicked.current) setEditing(false);
	}, [hasSaved]);
	(0, import_react.useEffect)(() => {
		if (editing) return;
		setShopDraft(savedName);
		setPhoneDraft(savedPhone);
		setIndustryDraft(savedIndustry);
		setSellDraft(savedVendor);
		setLangDraft(savedLang);
	}, [
		editing,
		savedName,
		savedPhone,
		savedIndustry,
		savedVendor,
		savedLang
	]);
	const locked = hasSaved && !editing;
	async function onSubmit(e) {
		e.preventDefault();
		const shopName = shopDraft.trim();
		if (!shopName) {
			setShopMsg("Enter your shop name.");
			return;
		}
		if (sellDraft && !industryDraft) {
			setShopMsg("Pick the trade you sell in.");
			return;
		}
		const identity = {
			shopName,
			phone: phoneDraft.trim(),
			industry: industryDraft,
			isVendor: sellDraft,
			language: langDraft
		};
		setShopIdentity(identity);
		editClicked.current = false;
		setEditing(false);
		setShopBusy(true);
		setShopMsg(null);
		try {
			const res = await saveProfile({ data: {
				shopName,
				phone: identity.phone,
				role: sellDraft ? "vendor" : role === "vendor" ? "vendor" : "customer",
				industry: industryDraft,
				isVendor: sellDraft,
				language: langDraft
			} });
			if (!res.ok) {
				setShopMsg(res.error);
				return;
			}
			setShopMsg("Shop details saved.");
		} catch (err) {
			setShopMsg(err instanceof Error ? err.message : "Could not save. Try again.");
		} finally {
			setShopBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-[var(--radius-xl)] border border-line bg-surface p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs font-medium uppercase tracking-wide text-muted",
					children: "Your shop"
				}), locked ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					type: "button",
					size: "sm",
					variant: "outline",
					onClick: () => {
						setShopDraft(savedName);
						setPhoneDraft(savedPhone);
						setIndustryDraft(savedIndustry);
						setSellDraft(savedVendor);
						setLangDraft(savedLang);
						editClicked.current = true;
						setEditing(true);
						setShopMsg(null);
					},
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, { className: "size-3.5" }), "Edit"]
				}) : null]
			}),
			locked ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-medium",
						children: savedName
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted",
						children: savedPhone || "No phone saved"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 text-sm text-muted",
						children: [
							savedIndustry ? INDUSTRY_LABEL[savedIndustry] : "Trade not set",
							savedVendor ? " · Listed as vendor" : " · Customer",
							` · ${LANGUAGES.find((l) => l.id === savedLang)?.label ?? savedLang}`
						]
					}),
					shopMsg ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: `mt-2 text-sm ${shopMsg.toLowerCase().includes("saved") ? "text-ok" : "text-danger"}`,
						children: shopMsg
					}) : null
				]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "mt-3",
				onSubmit: (e) => void onSubmit(e),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						className: "block text-xs text-muted",
						children: "Shop name"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						required: true,
						value: shopDraft,
						onChange: (e) => {
							setShopDraft(e.target.value);
							setShopMsg(null);
						},
						className: "mt-1 h-11 w-full rounded-[var(--radius-md)] border border-line bg-bg px-3 text-sm"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						className: "mt-3 block text-xs text-muted",
						children: "Phone"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						value: phoneDraft,
						onChange: (e) => {
							setPhoneDraft(e.target.value);
							setShopMsg(null);
						},
						className: "mt-1 h-11 w-full rounded-[var(--radius-md)] border border-line bg-bg px-3 text-sm"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						className: "mt-3 block text-xs text-muted",
						children: "Your trade"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
						value: industryDraft,
						onChange: (e) => setIndustryDraft(e.target.value),
						className: "mt-1 h-11 w-full rounded-[var(--radius-md)] border border-line bg-bg px-3 text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "",
							children: "Select industry"
						}), Object.entries(INDUSTRY_LABEL).map(([k, v]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: k,
							children: v
						}, k))]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						className: "mt-3 block text-xs text-muted",
						children: "Language"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
						value: langDraft,
						onChange: (e) => setLangDraft(e.target.value),
						className: "mt-1 h-11 w-full rounded-[var(--radius-md)] border border-line bg-bg px-3 text-sm",
						children: LANGUAGES.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: l.id,
							children: l.label
						}, l.id))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "mt-3 flex items-start gap-2 text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "checkbox",
							className: "mt-1",
							checked: sellDraft,
							onChange: (e) => setSellDraft(e.target.checked)
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "I sell on Vaani — list me as a vendor in this trade. Buyers who have this number send orders here." })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 flex gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							className: "flex-1",
							disabled: shopBusy,
							children: shopBusy ? "Saving…" : "Save shop details"
						}), hasSaved ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							variant: "outline",
							onClick: () => {
								setShopDraft(savedName);
								setPhoneDraft(savedPhone);
								setIndustryDraft(savedIndustry);
								setSellDraft(savedVendor);
								setLangDraft(savedLang);
								editClicked.current = false;
								setEditing(false);
								setShopMsg(null);
							},
							children: "Cancel"
						}) : null]
					}),
					shopMsg ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: `mt-2 text-sm ${shopMsg.includes("saved") ? "text-ok" : "text-danger"}`,
						children: shopMsg
					}) : null
				]
			}),
			extra
		]
	});
}
//#endregion
export { ShopCard as t };
