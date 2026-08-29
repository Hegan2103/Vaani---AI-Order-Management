import { createServerFn } from "@tanstack/react-start";
import { vaaniGate } from "./gate";
import { alignToSpoken, fallbackParse } from "./match";
import { LANGUAGES } from "./seed";
import type { LineItem } from "./types";

type ParseInput = {
  transcript?: string;
  audioBase64?: string;
  mimeType?: string;
  industry: string;
  language?: string;
};

function languageName(code?: string) {
  const id = code || "en-IN";
  return LANGUAGES.find((l) => l.id === id)?.label ?? id;
}

function outputRules() {
  return `productName and raw MUST be copied from the utterance as a contiguous substring.
Never invent, translate, transliterate into a different word, brand-match, or replace a salt/formulation with a brand.`;
}

async function stt(audioBase64: string, mimeType: string, apiKey: string) {
  const bin = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
  const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("mpeg") ? "mp3" : "webm";
  const blob = new Blob([bin], { type: mimeType || "audio/webm" });
  const form = new FormData();
  form.append("format", "false");
  form.append("file", blob, `order.${ext}`);
  const res = await fetch("https://api.x.ai/v1/stt", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`STT ${res.status}`);
  const body = (await res.json()) as { text?: string; language?: string };
  return { text: body.text ?? "", language: body.language ?? "und" };
}

function parseJsonObject(text: string): {
  language?: string;
  lines?: Array<{
    kind?: string;
    raw?: string;
    productName?: string;
    quantity?: number | null;
    unit?: string;
    confidence?: number;
  }>;
} | null {
  const jsonText = text.replace(/```json|```/g, "").trim();
  const start = jsonText.indexOf("{");
  const end = jsonText.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(jsonText.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function grokParse(transcript: string, industry: string, apiKey: string, languageHint?: string) {
  const target = languageHint || "en-IN";
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4.5",
      temperature: 0,
      max_tokens: 900,
      messages: [
        {
          role: "system",
          content: `Extract wholesale order lines from Indian shopkeeper speech. Return ONLY JSON.
${outputRules()}
If they said "Paracetamol 500" keep "Paracetamol 500" — not Crocin or Dolo.
If they said a brand, keep that brand.`,
        },
        {
          role: "user",
          content: `UI language: ${target}
Trade (context only): ${industry}

Utterance:
"""${transcript}"""

Rules:
- kind "order" when they want stock (product + quantity).
- kind "inquiry" when they ask rate/price/cost/kitna/daam.
- Keep quantity on inquiries too.
- Units include case/cases, box, strip, kg, bag, piece, bottle, tin, pack. If they said "8 case" quantity is 8 and unit is "case".
- catalogId is always null.
- raw MUST be a contiguous quote from the utterance.
- productName MUST also appear inside the utterance.

JSON:
{"language":"${target}","lines":[{"kind":"order"|"inquiry","raw":"quote from utterance","productName":"substring of utterance","quantity":1,"unit":"","confidence":0.0}]}`,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}`);
  const body = (await res.json()) as { choices: { message: { content: string } }[] };
  const parsed = parseJsonObject(body.choices[0]?.message.content ?? "");
  const lines: LineItem[] = (parsed?.lines ?? [])
    .map((l) => ({
      id: crypto.randomUUID(),
      kind: (l.kind === "inquiry" ? "inquiry" : "order") as LineItem["kind"],
      raw: l.raw ?? "",
      productName: (l.productName || l.raw || "").trim(),
      catalogId: null,
      quantity: typeof l.quantity === "number" ? l.quantity : null,
      unit: l.unit ?? "unit",
      status: "pending" as const,
      quotedPrice: null,
      rejectReason: null,
      confidence: typeof l.confidence === "number" ? l.confidence : 1,
    }))
    .filter((l) => l.productName);
  return { language: target, lines };
}

export const parseVoiceOrder = createServerFn({ method: "POST" })
  .middleware([vaaniGate])
  .validator((input: ParseInput) => input)
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    let transcript = data.transcript?.trim() ?? "";
    const outputLanguage = data.language || "en-IN";
    try {
      if (!transcript && data.audioBase64 && apiKey) {
        try {
          const st = await stt(data.audioBase64, data.mimeType || "audio/webm", apiKey);
          transcript = st.text || transcript;
        } catch {
          /* keep live transcript */
        }
      } else if (transcript.length < 6 && data.audioBase64 && apiKey) {
        try {
          const st = await stt(data.audioBase64, data.mimeType || "audio/webm", apiKey);
          if (st.text && st.text.length > transcript.length) transcript = st.text;
        } catch {
          /* keep live transcript */
        }
      }
      if (!transcript) {
        return { ok: false as const, error: "No speech captured. Type the order instead." };
      }
      const spoken = fallbackParse(transcript);
      if (apiKey) {
        try {
          const parsed = await grokParse(transcript, data.industry, apiKey, outputLanguage);
          const lines = alignToSpoken(transcript, parsed.lines.length ? parsed.lines : spoken);
          return {
            ok: true as const,
            transcript,
            language: outputLanguage,
            lines,
            source: parsed.lines.length ? ("ai" as const) : ("fallback" as const),
          };
        } catch (err) {
          return {
            ok: true as const,
            transcript,
            language: outputLanguage,
            lines: spoken,
            source: "fallback" as const,
            warning: err instanceof Error ? err.message : "AI parse failed",
          };
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI failed";
      if (transcript) {
        return {
          ok: true as const,
          transcript,
          language: outputLanguage,
          lines: fallbackParse(transcript),
          source: "fallback" as const,
          warning: msg,
        };
      }
      return { ok: false as const, error: msg };
    }
    return {
      ok: true as const,
      transcript,
      language: outputLanguage,
      lines: fallbackParse(transcript),
      source: "fallback" as const,
    };
  });

export const composeOrderCopy = createServerFn({ method: "POST" })
  .middleware([vaaniGate])
  .validator(
    (input: {
      shop: string;
      vendor: string;
      customer: string;
      industry: string;
      language: string;
      lines: LineItem[];
    }) => input,
  )
  .handler(async ({ data }) => {
    const accepted = data.lines.filter((l) => l.status === "accepted" || l.status === "confirmed");
    const quoted = data.lines.filter((l) => l.status === "quoted");
    const rejected = data.lines.filter((l) => l.status === "rejected");
    const apiKey = process.env.XAI_API_KEY;
    const fallback = () => {
      const rows = [
        ...accepted.map(
          (l) =>
            `ORDER  ${l.productName}  × ${l.quantity ?? "-"} ${l.unit}${l.quotedPrice != null ? `  @ ₹${l.quotedPrice}` : ""}`,
        ),
        ...quoted.map(
          (l) =>
            `QUOTE  ${l.productName}  × ${l.quantity ?? "-"} ${l.unit}  ₹${l.quotedPrice ?? "-"} / ${l.unit}`,
        ),
        ...rejected.map((l) => `UNAVAILABLE  ${l.productName}  ${l.rejectReason ?? ""}`),
      ];
      return `VAANI ORDER COPY
${data.shop}  →  ${data.vendor}
For: ${data.customer}

${rows.join("\n")}

Generated by Vaani. Not a tax invoice.`;
    };
    if (!apiKey) return { ok: true as const, text: fallback() };
    const lang = data.language || "en-IN";
    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "grok-4.5",
          temperature: 0.2,
          max_tokens: 700,
          messages: [
            {
              role: "system",
              content: `Write a clean wholesale order copy in ${languageName(lang)} only (${lang}). Use the product names exactly as given — they are already in the customer's language. Include quantity on every line, including price quotes. Plain text, no markdown fences, no emoji, no indicative total. Do not add a Hindi translation unless the selected language is Hindi.`,
            },
            {
              role: "user",
              content: JSON.stringify({
                vendor: data.vendor,
                shop: data.shop,
                customer: data.customer,
                industry: data.industry,
                language: lang,
                accepted,
                quoted,
                rejected,
              }),
            },
          ],
        }),
      });
      if (!res.ok) return { ok: true as const, text: fallback() };
      const body = (await res.json()) as { choices: { message: { content: string } }[] };
      const text = body.choices[0]?.message.content?.trim();
      return { ok: true as const, text: text || fallback() };
    } catch {
      return { ok: true as const, text: fallback() };
    }
  });
