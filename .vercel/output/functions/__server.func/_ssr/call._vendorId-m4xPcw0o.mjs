import { o as __toESM } from "../_runtime.mjs";
import { B as require_react, b as require_jsx_runtime, v as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as INDUSTRY_LABEL } from "./seed-CNZW8z6S.mjs";
import { t as fallbackParse } from "./match-CvBnGh7X.mjs";
import { o as Mic, r as Square } from "../_libs/lucide-react.mjs";
import { i as Route$3 } from "./router-n8WK8wsy.mjs";
import { p as saveTicket, t as Button } from "./login-screen-Ddp81uGG.mjs";
import { a as useVaani, n as StatusPill, o as vendorById, t as AppShell } from "./app-shell-C9DEuo4Y.mjs";
import { n as parseVoiceOrder } from "./ai-DxQcNzB0.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/call._vendorId-m4xPcw0o.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function CallScreen() {
	const { vendorId } = Route$3.useParams();
	const liveVendors = useVaani((s) => s.liveVendors);
	const found = vendorById(vendorId) ?? liveVendors.find((v) => v.id === vendorId);
	const navigate = useNavigate();
	const customerName = useVaani((s) => s.customerName);
	const customerPhone = useVaani((s) => s.customerPhone);
	const language = useVaani((s) => s.language);
	const upsertTicket = useVaani((s) => s.upsertTicket);
	const [phase, setPhase] = (0, import_react.useState)("idle");
	const [live, setLive] = (0, import_react.useState)("");
	const [transcript, setTranscript] = (0, import_react.useState)("");
	const [lines, setLines] = (0, import_react.useState)([]);
	const [error, setError] = (0, import_react.useState)(null);
	const [warning, setWarning] = (0, import_react.useState)(null);
	const recRef = (0, import_react.useRef)(null);
	const chunksRef = (0, import_react.useRef)([]);
	const streamRef = (0, import_react.useRef)(null);
	const speechRef = (0, import_react.useRef)(null);
	const liveRef = (0, import_react.useRef)("");
	const transcriptRef = (0, import_react.useRef)("");
	const listRef = (0, import_react.useRef)(null);
	if (!found) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Vendor not found." }) });
	const vendor = found;
	async function startRec() {
		setError(null);
		setWarning(null);
		chunksRef.current = [];
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			streamRef.current = stream;
			const rec = new MediaRecorder(stream);
			recRef.current = rec;
			rec.ondataavailable = (e) => {
				if (e.data.size) chunksRef.current.push(e.data);
			};
			rec.start(250);
			setPhase("recording");
			const w = window;
			const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
			if (Ctor) {
				const recg = new Ctor();
				recg.lang = language || "hi-IN";
				recg.continuous = true;
				recg.interimResults = true;
				recg.onresult = (ev) => {
					let t = "";
					for (let i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript + " ";
					liveRef.current = t.trim();
					setLive(t.trim());
				};
				recg.start();
				speechRef.current = recg;
			}
		} catch {
			setError("Microphone blocked. Type the order below instead.");
		}
	}
	async function stopAndParse(typed) {
		setPhase("parsing");
		setError(null);
		const rec = recRef.current;
		if (rec && rec.state !== "inactive") await new Promise((resolve) => {
			rec.onstop = () => resolve();
			rec.stop();
		});
		streamRef.current?.getTracks().forEach((t) => t.stop());
		try {
			speechRef.current?.stop();
		} catch {}
		let audioBase64;
		let mimeType;
		if (chunksRef.current.length) {
			const blob = new Blob(chunksRef.current, { type: rec?.mimeType || "audio/webm" });
			mimeType = blob.type;
			audioBase64 = await blobToB64(blob);
		}
		const spoken = (typed ?? transcriptRef.current ?? liveRef.current).trim() || liveRef.current.trim();
		try {
			const result = await parseVoiceOrder({ data: {
				transcript: spoken || void 0,
				audioBase64,
				mimeType,
				industry: vendor.industry,
				language: language || "hi-IN"
			} });
			if (!result.ok) {
				const local = spoken ? fallbackParse(spoken) : [];
				if (local.length) {
					setTranscript(spoken);
					transcriptRef.current = spoken;
					setLines(local);
					setWarning(result.error);
					setPhase("review");
					queueMicrotask(() => listRef.current?.scrollIntoView({
						behavior: "smooth",
						block: "start"
					}));
					return;
				}
				setError(result.error);
				setPhase("idle");
				return;
			}
			const text = result.transcript || spoken;
			setTranscript(text);
			transcriptRef.current = text;
			const next = result.lines;
			setLines(next.length ? next : fallbackParse(text));
			setWarning("warning" in result ? result.warning ?? null : null);
			setPhase("review");
			queueMicrotask(() => listRef.current?.scrollIntoView({
				behavior: "smooth",
				block: "start"
			}));
		} catch (err) {
			const spoken2 = spoken || liveRef.current;
			if (spoken2) {
				setTranscript(spoken2);
				transcriptRef.current = spoken2;
				setLines(fallbackParse(spoken2));
				setWarning(err instanceof Error ? err.message : "Could not reach Vaani. Showing a local parse.");
				setPhase("review");
				queueMicrotask(() => listRef.current?.scrollIntoView({
					behavior: "smooth",
					block: "start"
				}));
				return;
			}
			setError(err instanceof Error ? err.message : "Could not read the list.");
			setPhase("idle");
		}
	}
	async function send() {
		const ticket = {
			id: crypto.randomUUID(),
			vendorId: vendor.id,
			customerName: customerName || "Shop",
			customerPhone,
			language: language || "hi-IN",
			transcript,
			createdAt: (/* @__PURE__ */ new Date()).toISOString(),
			status: "sent",
			lines,
			orderCopy: null,
			notes: ""
		};
		upsertTicket(ticket);
		try {
			await saveTicket({ data: { ticket } });
		} catch {}
		navigate({
			to: "/ticket/$ticketId",
			params: { ticketId: ticket.id }
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-xs font-medium uppercase tracking-[0.16em] text-muted",
			children: "Calling"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "mt-1 font-display text-4xl tracking-tight",
			children: vendor.shop
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "text-sm text-muted",
			children: [
				vendor.name,
				" · ",
				vendor.phone,
				" · ",
				INDUSTRY_LABEL[vendor.industry]
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto mt-8 max-w-md rounded-[var(--radius-xl)] border border-line bg-surface p-6 text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: `mx-auto flex size-28 items-center justify-center rounded-full ${phase === "recording" ? "bg-danger text-accent-fg" : "bg-accent-soft text-accent"}`,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mic, { className: "size-10" })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-4 font-display text-xl",
					children: [
						phase === "idle" && "Connected — hold the line",
						phase === "recording" && "Listening",
						phase === "parsing" && "Vaani is reading the list",
						phase === "review" && "Your list"
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted",
					children: "Product + quantity to order. Name + cost/rate for a quote."
				}),
				phase === "idle" || phase === "review" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					className: "mt-6 w-full",
					size: "lg",
					onClick: () => void startRec(),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mic, { className: "size-4" }), phase === "review" ? "Speak again" : "Start speaking"]
				}) : null,
				phase === "recording" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					className: "mt-6 w-full",
					variant: "danger",
					size: "lg",
					onClick: () => void stopAndParse(),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Square, { className: "size-4" }), "Stop and show list"]
				}) : null,
				live ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-4 text-left text-sm text-muted",
					children: live
				}) : null
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto mt-6 max-w-md",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
					className: "text-xs text-muted",
					children: "Or type the list"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
					value: transcript,
					onChange: (e) => {
						transcriptRef.current = e.target.value;
						setTranscript(e.target.value);
					},
					rows: 3,
					placeholder: "Aata 25 kg, daal 10 kg, chini ka rate",
					className: "mt-1 w-full rounded-[var(--radius-md)] border border-line bg-surface p-3 text-sm"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					className: "mt-2 w-full",
					variant: "outline",
					disabled: phase === "parsing",
					onClick: () => void stopAndParse(transcriptRef.current),
					children: "Parse typed list"
				}),
				error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-danger",
					children: error
				}) : null,
				warning ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-warn",
					children: warning
				}) : null
			]
		}),
		(phase === "review" || lines.length > 0) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			ref: listRef,
			className: "mx-auto mt-8 max-w-lg space-y-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-2xl tracking-tight",
					children: "Extracted list"
				}),
				lines.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted",
					children: "No lines yet. Speak or type a product and quantity."
				}) : lines.map((line, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-[var(--radius-lg)] border border-line bg-surface p-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusPill, { status: line.kind }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs text-subtle",
								children: "As spoken"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: "mt-2 h-11 w-full rounded-[var(--radius-sm)] border border-line bg-bg px-3 text-sm",
							value: line.productName,
							onChange: (e) => {
								const next = lines.slice();
								next[i] = {
									...line,
									productName: e.target.value
								};
								setLines(next);
							}
						}),
						line.kind === "order" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-2 flex gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "number",
								className: "h-11 w-24 rounded-[var(--radius-sm)] border border-line bg-bg px-3 text-sm",
								value: line.quantity ?? "",
								onChange: (e) => {
									const next = lines.slice();
									next[i] = {
										...line,
										quantity: Number(e.target.value)
									};
									setLines(next);
								}
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "self-center text-sm text-muted",
								children: line.unit
							})]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 text-xs text-muted",
							children: "Price inquiry — vendor will quote"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-xs text-subtle",
							children: line.raw
						})
					]
				}, line.id)),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					className: "w-full",
					size: "lg",
					onClick: () => void send(),
					disabled: !lines.length,
					children: ["Send list to ", vendor.shop]
				})
			]
		})
	] });
}
function blobToB64(blob) {
	return new Promise((resolve, reject) => {
		const r = new FileReader();
		r.onload = () => {
			resolve(String(r.result).split(",")[1] ?? "");
		};
		r.onerror = () => reject(r.error);
		r.readAsDataURL(blob);
	});
}
//#endregion
export { CallScreen as component };
