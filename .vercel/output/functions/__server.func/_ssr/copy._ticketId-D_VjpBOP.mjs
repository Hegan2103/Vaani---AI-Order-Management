import { o as __toESM } from "../_runtime.mjs";
import { B as require_react, _ as Link, b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as INDUSTRY_LABEL } from "./seed-CNZW8z6S.mjs";
import { r as Route$2 } from "./router-n8WK8wsy.mjs";
import { a as getTicket, t as Button } from "./login-screen-Ddp81uGG.mjs";
import { a as useVaani, o as vendorById, r as readLastTicket, t as AppShell } from "./app-shell-C9DEuo4Y.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/copy._ticketId-D_VjpBOP.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function CopyPage() {
	const { ticketId } = Route$2.useParams();
	const role = useVaani((s) => s.role);
	const liveVendors = useVaani((s) => s.liveVendors);
	const found = useVaani((s) => s.tickets.find((t) => t.id === ticketId) ?? s.incoming.find((t) => t.id === ticketId));
	const upsertTicket = useVaani((s) => s.upsertTicket);
	const upsertIncoming = useVaani((s) => s.upsertIncoming);
	const [lookup, setLookup] = (0, import_react.useState)(found ? "ok" : "wait");
	(0, import_react.useEffect)(() => {
		if (found?.orderCopy) {
			setLookup("ok");
			return;
		}
		const last = readLastTicket();
		if (last && last.id === ticketId) {
			if (role === "vendor") upsertIncoming(last);
			else upsertTicket(last);
			setLookup("ok");
			return;
		}
		getTicket({ data: { id: ticketId } }).then((t) => {
			if (t) {
				if (role === "vendor") upsertIncoming(t);
				else upsertTicket(t);
				setLookup("ok");
			} else setLookup(found ? "ok" : "missing");
		}).catch(() => setLookup(found ? "ok" : "missing"));
	}, [
		found,
		ticketId,
		role,
		upsertTicket,
		upsertIncoming
	]);
	const ticket = found;
	if (lookup === "wait" && !ticket) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-sm text-muted",
		children: "Loading order copy…"
	}) });
	if (!ticket) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Order copy not found." }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
		to: role === "vendor" ? "/vendor" : "/",
		className: "mt-3 inline-block text-sm text-accent",
		children: "Back"
	})] });
	const vendor = vendorById(ticket.vendorId) ?? liveVendors.find((v) => v.id === ticket.vendorId);
	const accepted = ticket.lines.filter((l) => l.status === "accepted" || l.status === "confirmed");
	const quoted = ticket.lines.filter((l) => l.status === "quoted");
	const rejected = ticket.lines.filter((l) => l.status === "rejected");
	const total = accepted.reduce((sum, l) => {
		return sum + (l.kind === "order" ? l.quantity ?? 1 : 1) * (l.quotedPrice ?? 0);
	}, 0);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "no-print mb-4 flex flex-wrap gap-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			variant: "outline",
			onClick: () => window.print(),
			children: "Print / save PDF"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
			to: "/ticket/$ticketId",
			params: { ticketId: ticket.id },
			className: "inline-flex h-11 items-center text-sm text-muted",
			children: "Back to list"
		})]
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: "rounded-[var(--radius-xl)] border border-line bg-surface p-6 md:p-10",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start justify-between gap-4 border-b border-line pb-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-display text-3xl tracking-tight",
					children: "Vaani"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs uppercase tracking-[0.16em] text-muted",
					children: "Order copy"
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-right text-xs text-muted",
					children: [
						new Date(ticket.createdAt).toLocaleString("en-IN"),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
						ticket.id.slice(0, 8).toUpperCase()
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-5 grid gap-4 text-sm sm:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs uppercase tracking-wide text-muted",
						children: "Vendor"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-medium",
						children: vendor?.shop ?? "Vendor"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-muted",
						children: vendor?.name
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-muted",
						children: vendor?.phone
					})
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs uppercase tracking-wide text-muted",
						children: "Customer"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-medium",
						children: ticket.customerName
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-muted",
						children: ticket.customerPhone
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-muted",
						children: vendor ? INDUSTRY_LABEL[vendor.industry] : ""
					})
				] })]
			}),
			accepted.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mt-8",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-xl",
					children: "Accepted"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("table", {
					className: "mt-2 w-full text-sm",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: accepted.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: "border-b border-line",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "py-2",
								children: l.productName
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "py-2 text-right",
								children: l.kind === "order" ? `${l.quantity} ${l.unit}` : l.unit
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "py-2 text-right",
								children: l.quotedPrice != null ? `₹${l.quotedPrice}` : "—"
							})
						]
					}, l.id)) })
				})]
			}) : null,
			quoted.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mt-8",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-xl",
					children: "Quoted rates (awaiting customer)"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("table", {
					className: "mt-2 w-full text-sm",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: quoted.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: "border-b border-line",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "py-2",
							children: l.productName
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
							className: "py-2 text-right",
							children: [
								"₹",
								l.quotedPrice,
								" / ",
								l.unit
							]
						})]
					}, l.id)) })
				})]
			}) : null,
			rejected.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mt-8",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-xl",
					children: "Rejected"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-2 space-y-1 text-sm text-muted",
					children: rejected.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [l.productName, l.rejectReason ? ` — ${l.rejectReason}` : ""] }, l.id))
				})]
			}) : null,
			total > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-6 text-right font-display text-2xl",
				children: ["Indicative total ₹", total.toLocaleString("en-IN")]
			}) : null,
			ticket.orderCopy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
				className: "mt-8 whitespace-pre-wrap border-t border-line pt-5 font-sans text-sm leading-relaxed text-ink",
				children: ticket.orderCopy
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-8 text-sm text-muted",
				children: "Order copy will appear here after the customer finalizes."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-8 text-xs text-subtle",
				children: "Generated by Vaani from a voice list. Not a GST tax invoice. Confirm stock before dispatch."
			})
		]
	})] });
}
//#endregion
export { CopyPage as component };
