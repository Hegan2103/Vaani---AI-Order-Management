import { o as __toESM } from "../_runtime.mjs";
import { B as require_react, _ as Link, b as require_jsx_runtime, v as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as INDUSTRY_LABEL } from "./seed-CNZW8z6S.mjs";
import { n as Route$1 } from "./router-n8WK8wsy.mjs";
import { a as getTicket, p as saveTicket, t as Button } from "./login-screen-Ddp81uGG.mjs";
import { a as useVaani, n as StatusPill, o as vendorById, r as readLastTicket, t as AppShell } from "./app-shell-C9DEuo4Y.mjs";
import { t as composeOrderCopy } from "./ai-DxQcNzB0.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ticket._ticketId-DgRoxZ2z.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function TicketPage() {
	const { ticketId } = Route$1.useParams();
	const navigate = useNavigate();
	const role = useVaani((s) => s.role);
	const language = useVaani((s) => s.language);
	const liveVendors = useVaani((s) => s.liveVendors);
	const found = useVaani((s) => s.tickets.find((t) => t.id === ticketId) ?? s.incoming.find((t) => t.id === ticketId));
	const upsertTicket = useVaani((s) => s.upsertTicket);
	const upsertIncoming = useVaani((s) => s.upsertIncoming);
	const updateLines = useVaani((s) => s.updateLines);
	const setOrderCopy = useVaani((s) => s.setOrderCopy);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [err, setErr] = (0, import_react.useState)(null);
	const [lookup, setLookup] = (0, import_react.useState)(found ? "ok" : "wait");
	(0, import_react.useEffect)(() => {
		getTicket({ data: { id: ticketId } }).then((t) => {
			if (!t) {
				if (found) {
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
				setLookup("missing");
				return;
			}
			if (role === "vendor") upsertIncoming(t);
			else upsertTicket(t);
			setLookup("ok");
		}).catch(() => {
			if (found) setLookup("ok");
			else setLookup("missing");
		});
	}, [
		ticketId,
		role,
		upsertTicket,
		upsertIncoming
	]);
	if (lookup === "wait" || !found) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, { children: lookup === "missing" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Request not found." }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
		to: "/",
		className: "mt-3 inline-block text-sm text-accent",
		children: "Home"
	})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-sm text-muted",
		children: "Loading list…"
	}) });
	const ticket = found;
	const vendor = vendorById(ticket.vendorId) ?? liveVendors.find((v) => v.id === ticket.vendorId);
	const pending = ticket.lines.some((l) => l.status === "pending");
	const waitingOnPrice = ticket.lines.some((l) => l.status === "quoted");
	const ready = ticket.lines.length > 0 && !pending && !waitingOnPrice && ticket.lines.some((l) => l.status === "accepted" || l.status === "confirmed");
	function persist(next) {
		if (role === "vendor") upsertIncoming(next);
		else upsertTicket(next);
		saveTicket({ data: { ticket: next } }).catch(() => void 0);
	}
	function patch(i, part) {
		const lines = ticket.lines.map((l, idx) => idx === i ? {
			...l,
			...part
		} : l);
		const status = lines.some((l) => l.status === "quoted") ? "quoted" : lines.some((l) => l.status === "pending") ? "reviewing" : "confirmed";
		updateLines(ticket.id, lines, status);
		persist({
			...ticket,
			lines,
			status
		});
	}
	async function finalize() {
		setBusy(true);
		setErr(null);
		const res = await composeOrderCopy({ data: {
			shop: vendor?.shop ?? "Vendor",
			vendor: vendor?.name ?? vendor?.shop ?? "Vendor",
			customer: ticket.customerName,
			industry: vendor?.industry ?? "grocery",
			language: language || ticket.language || "hi-IN",
			lines: ticket.lines
		} });
		setBusy(false);
		if (!res.ok) {
			setErr("Could not compose the copy");
			return;
		}
		setOrderCopy(ticket.id, res.text);
		persist({
			...ticket,
			orderCopy: res.text,
			status: "finalized"
		});
		navigate({
			to: "/copy/$ticketId",
			params: { ticketId: ticket.id }
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-xs font-medium uppercase tracking-[0.16em] text-muted",
			children: role === "vendor" ? "Incoming list" : "Sent list"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-1 flex flex-wrap items-end justify-between gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-3xl tracking-tight md:text-4xl",
				children: role === "vendor" ? ticket.customerName || "Customer" : vendor?.shop ?? "Vendor"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-sm text-muted",
				children: [ticket.customerPhone, vendor ? ` · ${INDUSTRY_LABEL[vendor.industry]}` : ""]
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusPill, { status: ticket.status })]
		}),
		ticket.transcript ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("blockquote", {
			className: "mt-5 rounded-[var(--radius-lg)] border border-line bg-surface px-4 py-3 text-sm text-muted",
			children: ticket.transcript
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mt-6 space-y-3",
			children: ticket.lines.map((line, i) => {
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "rounded-[var(--radius-lg)] border border-line bg-surface p-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex flex-wrap items-center justify-between gap-2",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusPill, { status: line.kind }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusPill, { status: line.status })]
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 font-medium",
							children: line.productName
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-muted",
							children: line.kind === "order" ? `Qty ${line.quantity ?? "—"} ${line.unit}` : "Price inquiry"
						}),
						line.quotedPrice != null ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-sm",
							children: ["Quoted ₹", line.quotedPrice]
						}) : null,
						line.rejectReason ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-danger",
							children: line.rejectReason
						}) : null,
						role === "vendor" && line.status === "pending" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VendorActions, {
							line,
							onAccept: () => patch(i, { status: "accepted" }),
							onReject: () => patch(i, { status: "rejected" }),
							onQuote: (price) => patch(i, {
								status: "quoted",
								quotedPrice: price
							})
						}) : null,
						role === "customer" && line.status === "quoted" && line.quotedPrice != null ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-3 flex flex-wrap gap-2 border-t border-line pt-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								onClick: () => patch(i, { status: "confirmed" }),
								children: "Accept price"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								variant: "outline",
								onClick: () => patch(i, {
									status: "rejected",
									rejectReason: "Price not accepted"
								}),
								children: "Reject price"
							})]
						}) : null
					]
				}, line.id);
			})
		}),
		role === "vendor" && pending ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-4 text-sm text-muted",
			children: "Accept or reject every line. Quotes wait for the customer."
		}) : null,
		role === "vendor" && !pending && waitingOnPrice ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-4 text-sm text-muted",
			children: "Waiting for the customer to accept or reject quoted rates."
		}) : null,
		role === "customer" && waitingOnPrice ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-4 text-sm text-muted",
			children: "Accept or reject each quoted rate, then generate the order copy."
		}) : null,
		role === "customer" && ticket.status !== "finalized" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			className: "mt-6 w-full sm:w-auto",
			size: "lg",
			disabled: !ready || busy,
			onClick: () => void finalize(),
			children: busy ? "Writing order copy…" : "Finalize and generate copy"
		}) : null,
		ticket.status === "finalized" || ticket.orderCopy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
			to: "/copy/$ticketId",
			params: { ticketId: ticket.id },
			className: "mt-6 inline-flex h-12 items-center rounded-[var(--radius-md)] bg-accent px-5 text-sm font-medium text-accent-fg",
			children: "Open order copy"
		}) : null,
		err ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-3 text-sm text-danger",
			children: err
		}) : null
	] });
}
function VendorActions({ line, onAccept, onReject, onQuote }) {
	const [price, setPrice] = (0, import_react.useState)("");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "mt-3 flex flex-col gap-2 border-t border-line pt-3",
		children: line.kind === "order" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap gap-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				size: "sm",
				onClick: onAccept,
				children: "Accept"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				size: "sm",
				variant: "outline",
				onClick: onReject,
				children: "Reject"
			})]
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap gap-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "self-center text-sm text-muted",
					children: "₹"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "number",
					inputMode: "decimal",
					placeholder: "Rate",
					value: price,
					onChange: (e) => setPrice(e.target.value),
					className: "h-9 w-28 rounded-[var(--radius-sm)] border border-line bg-bg px-2 text-sm"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "sm",
					disabled: !price,
					onClick: () => onQuote(Number(price)),
					children: "Quote rate"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "sm",
					variant: "outline",
					onClick: onReject,
					children: "Reject"
				})
			]
		})
	});
}
//#endregion
export { TicketPage as component };
