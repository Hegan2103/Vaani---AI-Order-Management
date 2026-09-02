import type { CatalogItem, Contact, Industry, LineItem, Ticket, Vendor } from "./types";

function item(
  id: string,
  name: string,
  aliases: string[],
  unit: string,
  stock: number,
  listPrice: number,
): CatalogItem {
  return { id, name, aliases, unit, stock, listPrice };
}

const pharma: CatalogItem[] = [
  item("p1", "Dolo 650", ["dolo", "dolo 650", "paracetamol 650", "डोलो"], "strip", 240, 32),
  item("p2", "Crocin 500", ["crocin", "paracetamol 500", "pcm 500", "क्रोसिन"], "strip", 180, 28),
  item("p3", "Combiflam", ["combiflam", "ibuprofen", "कॉम्बिफ्लैम"], "strip", 90, 42),
  item("p4", "Cetirizine 10mg", ["cetrizine", "cetirizine", "allergy tablet", "सिट्रीजीन"], "strip", 200, 18),
  item("p5", "ORS Sachet", ["ors", "electral", "ओआरएस"], "sachet", 400, 12),
  item("p6", "Betadine 50ml", ["betadine", "povidone", "बेटाडीन"], "bottle", 40, 95),
  item("p7", "Amoxicillin 500", ["amox", "amoxicillin", "एमॉक्स"], "strip", 60, 78),
  item("p8", "Cough Syrup 100ml", ["cough syrup", "खांसी की दवाई", "corex"], "bottle", 35, 110),
];

const grocery: CatalogItem[] = [
  item("g1", "Wheat Flour (Aata)", ["aata", "atta", "wheat flour", "आटा", "गेहूं आटा"], "kg", 800, 42),
  item("g2", "Basmati Rice", ["rice", "chawal", "basmati", "चावल"], "kg", 500, 98),
  item("g3", "Toor Dal", ["dal", "daal", "toor", "arhar", "दाल", "तूर दाल"], "kg", 220, 145),
  item("g4", "Sugar", ["chini", "sugar", "चीनी"], "kg", 350, 48),
  item("g5", "Refined Oil", ["oil", "tel", "sunflower oil", "तेल"], "litre", 180, 145),
  item("g6", "Salt", ["namak", "salt", "नमक"], "kg", 400, 22),
  item("g7", "Tea Dust", ["tea", "chai", "चाय"], "kg", 80, 280),
  item("g8", "Turmeric", ["haldi", "turmeric", "हल्दी"], "kg", 40, 220),
];

const electrical: CatalogItem[] = [
  item("e1", "Copper Wire 1.5mm", ["1.5 mm wire", "1.5mm", "house wire", "तार 1.5"], "metre", 1200, 28),
  item("e2", "Copper Wire 2.5mm", ["2.5 mm wire", "2.5mm", "power wire", "तार 2.5"], "metre", 900, 46),
  item("e3", "MCB 32A", ["mcb", "32 amp mcb", "एमसीबी"], "piece", 80, 210),
  item("e4", "LED Bulb 9W", ["led", "9w", "bulb", "बल्ब"], "piece", 300, 85),
  item("e5", "Modular Switch", ["switch", "button", "स्विच"], "piece", 500, 42),
  item("e6", "6A Socket", ["socket", "plug point", "सॉकेट"], "piece", 220, 68),
];

const hardware: CatalogItem[] = [
  item("h1", "Wood Screw 2 inch", ["screw", "screws", "कांटा", "पेच"], "box", 90, 85),
  item("h2", "Door Hinge 4 inch", ["hinge", "hinges", "कब्जा"], "pair", 70, 120),
  item("h3", "Padlock 50mm", ["lock", "talla", "ताला"], "piece", 45, 160),
  item("h4", "Nails 2 inch", ["nail", "nails", "कील"], "kg", 60, 95),
  item("h5", "Hammer 500g", ["hammer", "hathoda", "हथौड़ा"], "piece", 25, 240),
  item("h6", "Enamel Paint 1L", ["paint", "enamel", "पेंट"], "litre", 40, 310),
];

const construction: CatalogItem[] = [
  item("c1", "OPC Cement 50kg", ["cement", "cement bag", "सीमेंट"], "bag", 400, 380),
  item("c2", "TMT Bar 12mm", ["steel", "tmt", "rod", "sariya", "सरिया", "छड़"], "bundle", 80, 2450),
  item("c3", "River Sand", ["sand", "ret", "रेत"], "cft", 2000, 48),
  item("c4", "Red Bricks", ["brick", "bricks", "ईंट"], "piece", 8000, 9),
  item("c5", "Vitrified Tile 2x2", ["tile", "tiles", "टाइल"], "box", 120, 780),
  item("c6", "Wall Putty 40kg", ["putty", "wall putty", "पुट्टी"], "bag", 90, 620),
];

const electronics: CatalogItem[] = [
  item("x1", "USB-C Cable 1m", ["usb cable", "type c", "केबल"], "piece", 150, 149),
  item("x2", "20W Fast Charger", ["charger", "adapter", "चार्जर"], "piece", 60, 499),
  item("x3", "Wired Earphones", ["earphones", "earphone", "इयरफोन"], "piece", 80, 299),
  item("x4", "32GB Pen Drive", ["pendrive", "pen drive", "usb", "पेनड्राइव"], "piece", 40, 420),
  item("x5", "HDMI Cable 2m", ["hdmi", "hdmi cable"], "piece", 35, 280),
  item("x6", "Power Bank 10000mAh", ["power bank", "पावर बैंक"], "piece", 22, 1299),
];

const catalogs: Record<Industry, CatalogItem[]> = {
  pharmaceutical: pharma,
  grocery,
  electrical,
  hardware,
  construction,
  electronics,
  consumer: grocery,
};

export const INDUSTRY_LABEL: Record<Industry, string> = {
  pharmaceutical: "Pharmaceutical",
  grocery: "Grocery / Kirana",
  electrical: "Electrical",
  hardware: "Hardware",
  construction: "Construction",
  electronics: "Electronics",
  consumer: "Consumer / Household",
};

export const LANGUAGES = [
  { id: "en-IN", label: "English", short: "EN" },
  { id: "hi-IN", label: "हिन्दी", short: "HI" },
  { id: "gu-IN", label: "ગુજરાતી", short: "GU" },
  { id: "mr-IN", label: "मराठी", short: "MR" },
  { id: "bn-IN", label: "বাংলা", short: "BN" },
  { id: "ta-IN", label: "தமிழ்", short: "TA" },
  { id: "te-IN", label: "తెలుగు", short: "TE" },
  { id: "kn-IN", label: "ಕನ್ನಡ", short: "KN" },
  { id: "ml-IN", label: "മലയാളം", short: "ML" },
  { id: "pa-IN", label: "ਪੰਜਾਬੀ", short: "PA" },
  { id: "or-IN", label: "ଓଡ଼ିଆ", short: "OR" },
  { id: "ur-IN", label: "اردو", short: "UR" },
] as const;

export type AppLanguage = (typeof LANGUAGES)[number]["id"];

export const VENDORS: Vendor[] = [
  {
    id: "v-mehta",
    name: "Rajesh Mehta",
    shop: "Mehta Medical Distributors",
    phone: "+91 98110 11221",
    city: "Ghaziabad",
    industry: "pharmaceutical",
    catalog: catalogs.pharmaceutical,
  },
  {
    id: "v-gupta",
    name: "Suresh Gupta",
    shop: "Gupta Kirana Bhandar",
    phone: "+91 98765 44321",
    city: "Meerut",
    industry: "grocery",
    catalog: catalogs.grocery,
  },
  {
    id: "v-sharma",
    name: "Vikram Sharma",
    shop: "Sharma Electricals",
    phone: "+91 99201 77880",
    city: "Noida",
    industry: "electrical",
    catalog: catalogs.electrical,
  },
  {
    id: "v-khan",
    name: "Imran Khan",
    shop: "Khan Hardware Mart",
    phone: "+91 97654 22109",
    city: "Delhi",
    industry: "hardware",
    catalog: catalogs.hardware,
  },
  {
    id: "v-patel",
    name: "Nilesh Patel",
    shop: "Patel Construction Supply",
    phone: "+91 90909 33445",
    city: "Ahmedabad",
    industry: "construction",
    catalog: catalogs.construction,
  },
  {
    id: "v-noida",
    name: "Priya Arora",
    shop: "Noida Electronics Hub",
    phone: "+91 98180 55667",
    city: "Noida",
    industry: "electronics",
    catalog: catalogs.electronics,
  },
  {
    id: "v-lakshmi",
    name: "Lakshmi Iyer",
    shop: "Lakshmi Pharma Agency",
    phone: "+91 94440 22331",
    city: "Chennai",
    industry: "pharmaceutical",
    catalog: catalogs.pharmaceutical,
  },
  {
    id: "v-anna",
    name: "Ramesh Yadav",
    shop: "Annapurna Kirana",
    phone: "+91 99351 66778",
    city: "Lucknow",
    industry: "grocery",
    catalog: catalogs.grocery,
  },
];

export const DEFAULT_CONTACTS: Contact[] = VENDORS.map((v) => ({
  id: `c-${v.id}`,
  name: v.shop,
  phone: v.phone,
  vendorId: v.id,
  source: "vaani",
}));

export const SAMPLE_UTTERANCES: Record<Industry, string[]> = {
  pharmaceutical: [
    "Dolo 650 20 strips aur Crocin ka rate",
    "Paracetamol 500 10 strip",
    "Cetirizine 10mg 5 strip ka price",
  ],
  grocery: [
    "Aata 25 kg, daal 10 kg, chini ka rate",
    "Chawal 20 kg aur tel 5 litre",
    "Namak 2 kg, haldi 500 gram",
  ],
  electrical: [
    "Copper wire 2.5 mm 90 metre, MCB 32A 4 piece",
    "LED bulb 9W 20 piece",
    "Switch 10 piece ka rate",
  ],
  hardware: [
    "Wood screw 2 inch 5 box, hinge 4 pair",
    "Nails 2 kg aur hammer 1 piece",
    "Padlock 50mm ka rate",
  ],
  construction: [
    "Cement 50 bags aur TMT rod ka rate",
    "Sand 2 brass, bricks 1000",
    "Putty 20 kg",
  ],
  electronics: [
    "USB cable 10 piece aur charger ka cost",
    "Earphone 5 piece",
    "Power bank ka rate",
  ],
  consumer: [
    "Aata 5 kg, doodh 2 litre, chini ka rate",
    "Chawal 10 kg aur tel 1 litre",
    "Namak 1 kg, haldi 200 gram",
  ],
};

export function samplesFor(industry: Industry | "" | "all") {
  if (industry && industry !== "all" && SAMPLE_UTTERANCES[industry]) return SAMPLE_UTTERANCES[industry];
  return SAMPLE_UTTERANCES.grocery;
}

export function allIndustrySamples() {
  return (Object.keys(INDUSTRY_LABEL) as Industry[]).map((id) => ({
    id,
    label: INDUSTRY_LABEL[id],
    samples: SAMPLE_UTTERANCES[id],
  }));
}

export function phoneDigits(phone: string) {
  let d = String(phone ?? "").replace(/\D/g, "");
  if (d.startsWith("0091") && d.length >= 14) d = d.slice(4);
  if (d.startsWith("91") && d.length >= 12) d = d.slice(2);
  if (d.startsWith("0") && d.length === 11) d = d.slice(1);
  if (d.length > 10) return d.slice(-10);
  return d;
}

export function formatInPhone(phone: string) {
  const ten = phoneDigits(phone);
  if (ten.length !== 10) return phone.trim();
  return `+91 ${ten.slice(0, 5)} ${ten.slice(5)}`;
}

export function vendorByPhone(phone: string) {
  const d = phoneDigits(phone);
  if (d.length !== 10) return undefined;
  return VENDORS.find((v) => phoneDigits(v.phone) === d);
}

export function phonesMatch(a: string, b: string) {
  const da = phoneDigits(a);
  const db = phoneDigits(b);
  return da.length === 10 && da === db;
}

export function inboxIdForUser(userId: string) {
  const id = userId.replace(/^u[:\-]/, "");
  return `u-${id}`;
}

function line(
  id: string,
  kind: LineItem["kind"],
  productName: string,
  quantity: number | null,
  unit: string,
  raw: string,
): LineItem {
  return {
    id,
    kind,
    raw,
    productName,
    catalogId: null,
    quantity,
    unit,
    status: "pending",
    quotedPrice: null,
    rejectReason: null,
    confidence: 1,
  };
}

/** Other buyers' voice lists for a shop — never owned by the signed-in user. */
export function demoIncomingFor(vendorId: string): Ticket[] {
  const vendor = VENDORS.find((v) => v.id === vendorId);
  if (!vendor) return [];
  const now = Date.now();
  const byIndustry: Record<Industry, { name: string; phone: string; language: string; transcript: string; lines: LineItem[] }[]> =
    {
      pharmaceutical: [
        {
          name: "Sharma Clinic",
          phone: "+91 98100 33445",
          language: "hi",
          transcript: "Paracetamol 500 20 strip, Cetirizine 10 mg ka rate, ORS 50 sachet",
          lines: [
            line("d1", "order", "Paracetamol 500", 20, "strip", "Paracetamol 500 20 strip"),
            line("d2", "inquiry", "Cetirizine 10 mg", null, "strip", "Cetirizine 10 mg ka rate"),
            line("d3", "order", "ORS", 50, "sachet", "ORS 50 sachet"),
          ],
        },
        {
          name: "City Medical Counter",
          phone: "+91 99001 22110",
          language: "en",
          transcript: "Amoxicillin 500 8 strips and cough syrup 100 ml rate",
          lines: [
            line("d4", "order", "Amoxicillin 500", 8, "strip", "Amoxicillin 500 8 strips"),
            line("d5", "inquiry", "cough syrup 100 ml", null, "bottle", "cough syrup 100 ml rate"),
          ],
        },
      ],
      grocery: [
        {
          name: "Anil General Store",
          phone: "+91 98711 55667",
          language: "hi",
          transcript: "Aata 50 kilo, toor dal 20 kg, chini ka rate",
          lines: [
            line("d1", "order", "Aata", 50, "kg", "Aata 50 kilo"),
            line("d2", "order", "toor dal", 20, "kg", "toor dal 20 kg"),
            line("d3", "inquiry", "chini", null, "kg", "chini ka rate"),
          ],
        },
        {
          name: "Maya Kirana",
          phone: "+91 97650 88990",
          language: "hi",
          transcript: "Tel 10 litre aur namak 25 kg",
          lines: [
            line("d4", "order", "Tel", 10, "litre", "Tel 10 litre"),
            line("d5", "order", "namak", 25, "kg", "namak 25 kg"),
          ],
        },
      ],
      electrical: [
        {
          name: "Verma Electrical Works",
          phone: "+91 98112 77889",
          language: "hi",
          transcript: "1.5 mm wire 90 metre, MCB 32 amp 6 piece, 9 watt bulb ka rate",
          lines: [
            line("d1", "order", "1.5 mm wire", 90, "metre", "1.5 mm wire 90 metre"),
            line("d2", "order", "MCB 32 amp", 6, "piece", "MCB 32 amp 6 piece"),
            line("d3", "inquiry", "9 watt bulb", null, "piece", "9 watt bulb ka rate"),
          ],
        },
      ],
      hardware: [
        {
          name: "Singh Furniture",
          phone: "+91 97111 22334",
          language: "hi",
          transcript: "2 inch screw 4 box, kabja 10 pair, talla ka price",
          lines: [
            line("d1", "order", "2 inch screw", 4, "box", "2 inch screw 4 box"),
            line("d2", "order", "kabja", 10, "pair", "kabja 10 pair"),
            line("d3", "inquiry", "talla", null, "piece", "talla ka price"),
          ],
        },
      ],
      construction: [
        {
          name: "Yadav Site Store",
          phone: "+91 90909 11223",
          language: "hi",
          transcript: "Cement 80 bags, sariya 12 mm ka rate, ret 200 cft",
          lines: [
            line("d1", "order", "Cement", 80, "bag", "Cement 80 bags"),
            line("d2", "inquiry", "sariya 12 mm", null, "bundle", "sariya 12 mm ka rate"),
            line("d3", "order", "ret", 200, "cft", "ret 200 cft"),
          ],
        },
      ],
      electronics: [
        {
          name: "Gadget Point",
          phone: "+91 98180 33445",
          language: "en",
          transcript: "Type C cable 15 piece, 20 watt charger ka cost, earphones 8 piece",
          lines: [
            line("d1", "order", "Type C cable", 15, "piece", "Type C cable 15 piece"),
            line("d2", "inquiry", "20 watt charger", null, "piece", "20 watt charger ka cost"),
            line("d3", "order", "earphones", 8, "piece", "earphones 8 piece"),
          ],
        },
      ],
      consumer: [
        {
          name: "Home Order",
          phone: "+91 98711 55667",
          language: "hi",
          transcript: "Aata 5 kilo, doodh 2 litre, chini ka rate",
          lines: [
            line("d1", "order", "Aata", 5, "kg", "Aata 5 kilo"),
            line("d2", "order", "doodh", 2, "litre", "doodh 2 litre"),
            line("d3", "inquiry", "chini", null, "kg", "chini ka rate"),
          ],
        },
      ],
    };

  const rows = byIndustry[vendor.industry] ?? byIndustry.grocery;
  return rows.map((row, i) => ({
    id: `in-${vendorId}-${i + 1}`,
    vendorId,
    customerName: row.name,
    customerPhone: row.phone,
    language: row.language,
    transcript: row.transcript,
    createdAt: new Date(now - (i + 1) * 47 * 60 * 1000).toISOString(),
    status: "sent" as const,
    lines: row.lines.map((l) => ({ ...l, id: `in-${vendorId}-${i + 1}-${l.id}` })),
    orderCopy: null,
    notes: "",
  }));
}

export function demoIncomingForIndustry(industry: Industry, inboxId: string): Ticket[] {
  const sample = VENDORS.find((v) => v.industry === industry) ?? VENDORS[0];
  const slug = inboxId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "shop";
  return demoIncomingFor(sample.id).map((t, i) => ({
    ...t,
    id: `in-${slug}-${i + 1}`,
    vendorId: inboxId,
    lines: t.lines.map((l, j) => ({ ...l, id: `in-${slug}-${i + 1}-l${j}` })),
  }));
}
