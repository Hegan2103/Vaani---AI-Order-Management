export type Industry =
  | "pharmaceutical"
  | "grocery"
  | "electrical"
  | "hardware"
  | "construction"
  | "electronics";

export type Role = "customer" | "vendor";

export type LineKind = "order" | "inquiry";

export type LineStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "quoted"
  | "confirmed";

export type TicketStatus =
  | "draft"
  | "sent"
  | "reviewing"
  | "quoted"
  | "confirmed"
  | "finalized"
  | "delivered";

export type CatalogItem = {
  id: string;
  name: string;
  aliases: string[];
  unit: string;
  stock: number;
  listPrice: number;
};

export type Vendor = {
  id: string;
  name: string;
  shop: string;
  phone: string;
  city: string;
  industry: Industry;
  catalog: CatalogItem[];
  altPhones?: string[];
};

export type LineItem = {
  id: string;
  kind: LineKind;
  raw: string;
  productName: string;
  catalogId: string | null;
  matchedName?: string | null;
  quantity: number | null;
  unit: string;
  status: LineStatus;
  quotedPrice: number | null;
  rejectReason: string | null;
  confidence: number;
};

export type Ticket = {
  id: string;
  vendorId: string;
  customerName: string;
  customerPhone: string;
  language: string;
  transcript: string;
  createdAt: string;
  status: TicketStatus;
  lines: LineItem[];
  orderCopy: string | null;
  notes: string;
  updatedAt?: string;
};

export type Contact = {
  id: string;
  name: string;
  phone: string;
  vendorId: string | null;
  source: "phone" | "vaani";
};

export type VaaniNotice = {
  id: string;
  at: string;
  title: string;
  body: string;
  ticketId: string;
  read: boolean;
  audience: "customer" | "vendor";
};

