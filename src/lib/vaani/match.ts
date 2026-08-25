import type { LineItem, LineKind } from "./types";

const INQUIRY_WORDS =
  /\b(rate|price|cost|kitna|kitne|kitni|daam|bhao|भाव|कीमत|रेट|price of|ka rate|ka price|ka cost|enq|inquiry|quote)\b/i;

const UNIT =
  "kg|kilo|kilogram|bag|bags|strip|strips|litre|liter|ltr|metre|meter|mtr|piece|pcs|pc|box|boxes|sachet|bottle|bundle|cft|gram|gm|ml|pack|packs|unit|units|tin|tins";

export function inferKind(text: string): LineKind {
  return INQUIRY_WORDS.test(text) ? "inquiry" : "order";
}

function nameFromChunk(chunk: string, _quantity: number | null, qtyText?: string) {
  let name = chunk;
  if (qtyText) name = name.replace(qtyText, " ");
  name = name.replace(INQUIRY_WORDS, " ").replace(/\s+/g, " ").trim();
  return name || chunk.trim();
}

function parseChunk(chunk: string): LineItem {
  const kind = inferKind(chunk);
  const qtyMatch = chunk.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${UNIT})\\b`, "i"));
  const trailingQty = chunk.match(/(\d+(?:\.\d+)?)\s*$/);
  const keepStrength = /\d+\s*(mg|ml)\b/i.test(chunk);
  const quantity = qtyMatch
    ? Number(qtyMatch[1])
    : trailingQty && !keepStrength
      ? Number(trailingQty[1])
      : kind === "inquiry"
        ? null
        : 1;
  const unit = (qtyMatch?.[2] || "unit").toLowerCase();
  const qtyText = qtyMatch?.[0] || (trailingQty && quantity === Number(trailingQty[1]) ? trailingQty[0] : "");
  return {
    id: crypto.randomUUID(),
    kind,
    raw: chunk,
    productName: nameFromChunk(chunk, quantity, qtyText),
    catalogId: null,
    quantity,
    unit,
    status: "pending",
    quotedPrice: null,
    rejectReason: null,
    confidence: 1,
  };
}

/** Split speech into lines. Keep the spoken product name — never map to a catalog/brand. */
export function fallbackParse(transcript: string): LineItem[] {
  const chunks = transcript
    .split(/,| aur | and | तथा | एवं |\n|;| फिर | phir | और /i)
    .map((s) => s.trim())
    .filter(Boolean);
  const lines = chunks.map(parseChunk);
  if (lines.length === 0 && transcript.trim()) {
    lines.push(parseChunk(transcript.trim()));
  }
  return lines;
}

function sliceIn(transcript: string, piece: string) {
  const t = transcript.toLowerCase();
  const p = piece.toLowerCase().trim();
  if (!p) return "";
  const i = t.indexOf(p);
  if (i >= 0) return transcript.slice(i, i + piece.trim().length);
  return "";
}

/** Force every line's productName to come from the spoken transcript. */
export function alignToSpoken(transcript: string, aiLines: LineItem[]): LineItem[] {
  const spoken = fallbackParse(transcript);
  if (!aiLines.length) return spoken;

  const used = new Set<number>();
  const aligned: LineItem[] = [];
  for (const ai of aiLines) {
    const fromRaw = sliceIn(transcript, ai.raw || "");
    const fromName = sliceIn(transcript, ai.productName || "");
    const chunk = fromRaw || fromName;
    if (chunk) {
      const local = parseChunk(chunk);
      aligned.push({
        ...local,
        kind: ai.kind === "inquiry" || local.kind === "inquiry" ? "inquiry" : "order",
        quantity: ai.quantity ?? local.quantity,
        unit: ai.unit && ai.unit !== "unit" ? ai.unit : local.unit,
        productName: local.productName,
        raw: chunk,
      });
      continue;
    }
    let best = -1;
    let bestScore = 0;
    const words = new Set(ai.productName.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
    spoken.forEach((s, i) => {
      if (used.has(i)) return;
      const score = s.productName
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => words.has(w)).length;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    });
    if (best >= 0 && bestScore > 0) {
      used.add(best);
      const local = spoken[best];
      aligned.push({
        ...local,
        kind: ai.kind === "inquiry" || local.kind === "inquiry" ? "inquiry" : "order",
        quantity: ai.quantity ?? local.quantity,
        unit: ai.unit && ai.unit !== "unit" ? ai.unit : local.unit,
        productName: local.productName,
      });
    }
  }
  return aligned.length ? aligned : spoken;
}
