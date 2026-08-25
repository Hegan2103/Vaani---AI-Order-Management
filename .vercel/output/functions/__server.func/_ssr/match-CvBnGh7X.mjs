//#region node_modules/.nitro/vite/services/ssr/assets/match-CvBnGh7X.js
var INQUIRY_WORDS = /\b(rate|price|cost|kitna|kitne|kitni|daam|bhao|भाव|कीमत|रेट|price of|ka rate|ka price|ka cost|enq|inquiry|quote)\b/i;
function inferKind(text) {
	return INQUIRY_WORDS.test(text) ? "inquiry" : "order";
}
/** Split speech into lines. Keep the spoken product name — never map to a catalog/brand. */
function fallbackParse(transcript) {
	const chunks = transcript.split(/,| aur | and | तथा | एवं |\n|;/i).map((s) => s.trim()).filter(Boolean);
	const lines = [];
	for (const chunk of chunks) {
		const kind = inferKind(chunk);
		const qtyMatch = chunk.match(/(\d+(?:\.\d+)?)\s*(kg|kilo|bag|bags|strip|strips|litre|liter|ltr|metre|meter|mtr|piece|pcs|pc|box|sachet|bottle|bundle|cft)?/i);
		const quantity = kind === "order" && qtyMatch ? Number(qtyMatch[1]) : kind === "inquiry" ? null : 1;
		const unit = qtyMatch?.[2]?.toLowerCase() ?? "";
		const nameGuess = chunk.replace(INQUIRY_WORDS, " ").replace(/\d+(?:\.\d+)?/g, " ").replace(/\b(kg|kilo|bag|bags|strip|strips|order|karna|hai|do|dena|please|ka|ki|ke)\b/gi, " ").replace(/\s+/g, " ").trim();
		lines.push({
			id: crypto.randomUUID(),
			kind,
			raw: chunk,
			productName: nameGuess || chunk,
			catalogId: null,
			quantity,
			unit: unit || "unit",
			status: "pending",
			quotedPrice: null,
			rejectReason: null,
			confidence: 1
		});
	}
	return lines;
}
//#endregion
export { fallbackParse as t };
