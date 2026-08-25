import { o as __toESM } from "../_runtime.mjs";
import { B as require_react, _ as Link, b as require_jsx_runtime, v as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as VENDORS, i as SAMPLE_UTTERANCES, n as INDUSTRY_LABEL } from "./seed-CNZW8z6S.mjs";
import { c as BookUser, i as Phone, o as Mic } from "../_libs/lucide-react.mjs";
import { t as Button } from "./login-screen-Ddp81uGG.mjs";
import { a as useVaani, n as StatusPill, o as vendorById, s as vendorForPhone, t as AppShell } from "./app-shell-C9DEuo4Y.mjs";
import { t as ShopCard } from "./shop-card-Te2atqWQ.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-qt3zJd_J.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Home() {
	const navigate = useNavigate();
	const setRole = useVaani((s) => s.setRole);
	const contacts = useVaani((s) => s.contacts);
	const tickets = useVaani((s) => s.tickets);
	const mergeContacts = useVaani((s) => s.mergeContacts);
	const liveVendors = useVaani((s) => s.liveVendors);
	const [q, setQ] = (0, import_react.useState)("");
	const [industry, setIndustry] = (0, import_react.useState)("all");
	const [importMsg, setImportMsg] = (0, import_react.useState)(null);
	const filtered = (0, import_react.useMemo)(() => {
		return contacts.filter((c) => {
			const v = vendorForPhone(c.phone) ?? (c.vendorId ? vendorById(c.vendorId) : void 0);
			if (industry !== "all" && v?.industry !== industry) return false;
			return `${c.name} ${c.phone} ${v?.city ?? ""} ${v?.shop ?? ""}`.toLowerCase().includes(q.toLowerCase());
		});
	}, [
		contacts,
		q,
		industry,
		liveVendors
	]);
	async function pullDirectory() {
		const nav = navigator;
		try {
			if (nav.contacts?.select) {
				const picked = await nav.contacts.select(["name", "tel"], { multiple: true });
				const extra = [];
				for (const p of picked) {
					const phone = p.tel?.[0];
					if (!phone) continue;
					const matched = vendorForPhone(phone) ?? VENDORS.find((v) => v.phone.replace(/\s/g, "") === phone.replace(/\s/g, ""));
					extra.push({
						id: crypto.randomUUID(),
						name: p.name?.[0] || phone,
						phone,
						vendorId: matched?.id ?? null,
						source: "phone"
					});
				}
				mergeContacts(extra);
				setImportMsg(`Imported ${extra.length} contact${extra.length === 1 ? "" : "s"} from this phone.`);
				return;
			}
		} catch {}
		const extras = [
			{
				id: crypto.randomUUID(),
				name: "Mama Medical Store",
				phone: "+91 98110 11221",
				vendorId: "v-mehta",
				source: "phone"
			},
			{
				id: crypto.randomUUID(),
				name: "Local Kirana (Suresh)",
				phone: "+91 98765 44321",
				vendorId: "v-gupta",
				source: "phone"
			},
			{
				id: crypto.randomUUID(),
				name: "Site Cement Wala",
				phone: "+91 90909 33445",
				vendorId: "v-patel",
				source: "phone"
			}
		];
		mergeContacts(extras);
		setImportMsg("Loaded vendors saved in this phone directory.");
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mb-8 grid gap-6 md:grid-cols-[1.2fr_0.8fr]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs font-medium uppercase tracking-[0.16em] text-muted",
					children: "For every shop"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
					className: "mt-2 font-display text-4xl leading-tight tracking-tight md:text-5xl",
					children: [
						"Speak the order.",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
						"Skip the weekly call."
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 max-w-prose text-muted",
					children: "Dial a vendor from your phone book. Say product and quantity to place stock, or name and cost to ask a rate. Vaani structures it. They accept, reject, or quote. You get one order copy."
				})
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShopCard, { extra: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				className: "mt-3 w-full",
				variant: "outline",
				onClick: () => {
					setRole("vendor");
					navigate({ to: "/vendor" });
				},
				children: "I am a vendor"
			}) })]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-display text-2xl tracking-tight",
				children: "Phone directory"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				variant: "outline",
				onClick: () => void pullDirectory(),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookUser, { className: "size-4" }), "Pull from contacts"]
			})]
		}),
		importMsg ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mb-3 text-sm text-ok",
			children: importMsg
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mb-4 flex flex-col gap-2 sm:flex-row",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				value: q,
				onChange: (e) => setQ(e.target.value),
				placeholder: "Search name or number",
				className: "h-11 flex-1 rounded-[var(--radius-md)] border border-line bg-surface px-3 text-sm"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
				value: industry,
				onChange: (e) => setIndustry(e.target.value),
				className: "h-11 rounded-[var(--radius-md)] border border-line bg-surface px-3 text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
					value: "all",
					children: "All trades"
				}), Object.entries(INDUSTRY_LABEL).map(([k, v]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
					value: k,
					children: v
				}, k))]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "divide-y divide-line overflow-hidden rounded-[var(--radius-xl)] border border-line bg-surface",
			children: filtered.map((c) => {
				const v = vendorForPhone(c.phone) ?? (c.vendorId ? vendorById(c.vendorId) : void 0);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex items-center gap-3 px-4 py-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-soft font-display text-accent",
							children: c.name.slice(0, 1)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0 flex-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "truncate font-medium",
								children: c.name
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "truncate text-xs text-muted",
								children: [c.phone, v ? ` · On Vaani · ${INDUSTRY_LABEL[v.industry]}${v.city ? ` · ${v.city}` : ""}` : " · not on Vaani"]
							})]
						}),
						v ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/call/$vendorId",
							params: { vendorId: v.id },
							className: "inline-flex size-11 items-center justify-center rounded-[var(--radius-md)] bg-accent text-accent-fg",
							"aria-label": `Call ${c.name}`,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Phone, { className: "size-4" })
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-xs text-subtle",
							children: "Not on Vaani"
						})
					]
				}, c.id);
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-4 text-xs text-subtle",
			children: "Say product + quantity to order. Say product + cost/rate/kitna to inquire. Hindi, English, and other Indian languages work. Spoken names stay as spoken."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-3 flex flex-wrap gap-2",
			children: SAMPLE_UTTERANCES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted",
				children: s
			}, s))
		}),
		tickets.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-10",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "mb-3 font-display text-2xl tracking-tight",
				children: "Your requests"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "space-y-2",
				children: tickets.slice(0, 8).map((t) => {
					const v = vendorById(t.vendorId);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/ticket/$ticketId",
						params: { ticketId: t.id },
						className: "flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-line bg-surface px-4 py-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "truncate font-medium",
								children: v?.shop ?? "Vendor"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "truncate text-xs text-muted",
								children: [
									t.lines.length,
									" lines · ",
									new Date(t.createdAt).toLocaleString("en-IN")
								]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusPill, { status: t.status })]
					}) }, t.id);
				})
			})]
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "mt-10 flex items-center gap-2 text-sm text-muted",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mic, { className: "size-4" }), "No voice orders yet. Pick a vendor and speak."]
		})
	] });
}
//#endregion
export { Home as component };
