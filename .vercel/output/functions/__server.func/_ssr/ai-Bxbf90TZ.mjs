import { r as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-CcvdN_gc.mjs";
import { t as authMiddleware } from "./middleware-HWUekL9b.mjs";
import { t as fallbackParse } from "./match-CvBnGh7X.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ai-Bxbf90TZ.js
async function stt(audioBase64, mimeType, apiKey) {
	const bin = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
	const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("mpeg") ? "mp3" : "webm";
	const blob = new Blob([bin], { type: mimeType || "audio/webm" });
	const form = new FormData();
	form.append("format", "false");
	form.append("file", blob, `order.${ext}`);
	const res = await fetch("https://api.x.ai/v1/stt", {
		method: "POST",
		headers: { Authorization: `Bearer ${apiKey}` },
		body: form
	});
	if (!res.ok) throw new Error(`STT ${res.status}`);
	const body = await res.json();
	return {
		text: body.text ?? "",
		language: body.language ?? "und"
	};
}
async function grokParse(transcript, industry, apiKey, languageHint) {
	const res = await fetch("https://api.x.ai/v1/chat/completions", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			model: "grok-4.5",
			temperature: 0,
			max_tokens: 900,
			messages: [{
				role: "system",
				content: "You extract wholesale order lines from Indian shopkeeper speech (Hindi, Hinglish, Tamil, Telugu, Marathi, Gujarati, Bengali, Punjabi, Kannada, Malayalam, English). Return ONLY JSON. Never rewrite, brand-match, or catalog-match a spoken product."
			}, {
				role: "user",
				content: `Utterance language preference: ${languageHint || "auto"}
Trade (context only, do not map to a stock list): ${industry}

Utterance:
"""${transcript}"""

Rules:
- kind "order" when they want stock (product + quantity).
- kind "inquiry" when they ask rate/price/cost/kitna/daam.
- productName MUST be exactly what they said (formulation, salt, strength, local name). Do not substitute a brand or SKU.
- Do not match to inventory. catalogId is always null.
- quantity null for inquiries.
- Keep original language in raw and productName.

JSON shape:
{"language":"hi|en|...","lines":[{"kind":"order"|"inquiry","raw":"","productName":"exactly as spoken","quantity":1,"unit":"","confidence":0.0}]}`
			}]
		})
	});
	if (!res.ok) throw new Error(`LLM ${res.status}`);
	const jsonText = ((await res.json()).choices[0]?.message.content ?? "{}").replace(/```json|```/g, "").trim();
	const start = jsonText.indexOf("{");
	const end = jsonText.lastIndexOf("}");
	const parsed = JSON.parse(jsonText.slice(start, end + 1));
	const lines = (parsed.lines ?? []).map((l) => ({
		id: crypto.randomUUID(),
		kind: l.kind === "inquiry" ? "inquiry" : "order",
		raw: l.raw ?? "",
		productName: (l.productName || l.raw || "").trim(),
		catalogId: null,
		quantity: typeof l.quantity === "number" ? l.quantity : null,
		unit: l.unit ?? "unit",
		status: "pending",
		quotedPrice: null,
		rejectReason: null,
		confidence: typeof l.confidence === "number" ? l.confidence : 1
	}));
	return {
		language: parsed.language ?? "en",
		lines
	};
}
var parseVoiceOrder_createServerFn_handler = createServerRpc({
	id: "9fb45d9282a026962d36dbf0e7433bfe7e7c10d28f1ca9e65a75a7c3fe1a3d9b",
	name: "parseVoiceOrder",
	filename: "src/lib/vaani/ai.ts"
}, (opts) => parseVoiceOrder.__executeServer(opts));
var parseVoiceOrder = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(parseVoiceOrder_createServerFn_handler, async ({ data }) => {
	const apiKey = process.env.XAI_API_KEY;
	let transcript = data.transcript?.trim() ?? "";
	let language = data.language || "en";
	try {
		if (!transcript && data.audioBase64 && apiKey) {
			const st = await stt(data.audioBase64, data.mimeType || "audio/webm", apiKey);
			transcript = st.text;
			language = st.language || language;
		}
		if (!transcript) return {
			ok: false,
			error: "No speech captured. Type the order instead."
		};
		if (apiKey) {
			const parsed = await grokParse(transcript, data.industry, apiKey, data.language);
			return {
				ok: true,
				transcript,
				language: parsed.language || language,
				lines: parsed.lines.length ? parsed.lines : fallbackParse(transcript),
				source: "ai"
			};
		}
	} catch (err) {
		const msg = err instanceof Error ? err.message : "AI failed";
		if (transcript) return {
			ok: true,
			transcript,
			language,
			lines: fallbackParse(transcript),
			source: "fallback",
			warning: msg
		};
		return {
			ok: false,
			error: msg
		};
	}
	return {
		ok: true,
		transcript,
		language,
		lines: fallbackParse(transcript),
		source: "fallback"
	};
});
var composeOrderCopy_createServerFn_handler = createServerRpc({
	id: "00ed397e18128a291a03f51bf39ac47c48c271e9318f5e375dac0072537d2b90",
	name: "composeOrderCopy",
	filename: "src/lib/vaani/ai.ts"
}, (opts) => composeOrderCopy.__executeServer(opts));
var composeOrderCopy = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(composeOrderCopy_createServerFn_handler, async ({ data }) => {
	const accepted = data.lines.filter((l) => l.status === "accepted" || l.status === "confirmed");
	const quoted = data.lines.filter((l) => l.status === "quoted");
	const rejected = data.lines.filter((l) => l.status === "rejected");
	const apiKey = process.env.XAI_API_KEY;
	const fallback = () => {
		const rows = [
			...accepted.map((l) => `ORDER  ${l.productName}  × ${l.quantity ?? "-"} ${l.unit}${l.quotedPrice != null ? `  @ ₹${l.quotedPrice}` : ""}`),
			...quoted.map((l) => `QUOTE  ${l.productName}  ₹${l.quotedPrice ?? "-"} / ${l.unit}`),
			...rejected.map((l) => `UNAVAILABLE  ${l.productName}  ${l.rejectReason ?? ""}`)
		];
		return `VAANI ORDER COPY
${data.shop}  →  ${data.vendor}
For: ${data.customer}

${rows.join("\n")}

Generated by Vaani. Not a tax invoice.`;
	};
	if (!apiKey) return {
		ok: true,
		text: fallback()
	};
	try {
		const res = await fetch("https://api.x.ai/v1/chat/completions", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`
			},
			body: JSON.stringify({
				model: "grok-4.5",
				temperature: .2,
				max_tokens: 700,
				messages: [{
					role: "system",
					content: "Write a clean bilingual (English + the customer's language if not English) wholesale order copy. Use the spoken product names as-is. Plain text, no markdown fences, no emoji. Letterhead style."
				}, {
					role: "user",
					content: JSON.stringify({
						vendor: data.vendor,
						shop: data.shop,
						customer: data.customer,
						industry: data.industry,
						language: data.language,
						accepted,
						quoted,
						rejected
					})
				}]
			})
		});
		if (!res.ok) return {
			ok: true,
			text: fallback()
		};
		return {
			ok: true,
			text: (await res.json()).choices[0]?.message.content?.trim() || fallback()
		};
	} catch {
		return {
			ok: true,
			text: fallback()
		};
	}
});
//#endregion
export { composeOrderCopy_createServerFn_handler, parseVoiceOrder_createServerFn_handler };
