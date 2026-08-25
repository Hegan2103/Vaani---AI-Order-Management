import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { inboxIdForUser, phoneDigits } from "@/lib/vaani/seed";
import type { Industry, Vendor } from "@/lib/vaani/types";

const TRADES: Industry[] = [
  "pharmaceutical",
  "grocery",
  "electrical",
  "hardware",
  "construction",
  "electronics",
];

export const Route = createFileRoute("/api/vaani/vendors")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const sql = await getSql();
          await sql.query(`
            create table if not exists vaani_profiles (
              user_id text primary key,
              shop_name text not null default '',
              phone text not null default '',
              role text not null default 'customer'
            )
          `);
          await sql.query(`alter table vaani_profiles add column if not exists vendor_id text not null default ''`);
          await sql.query(`alter table vaani_profiles add column if not exists industry text not null default ''`);
          await sql.query(`alter table vaani_profiles add column if not exists is_vendor boolean not null default false`);
          await sql.query(`alter table vaani_profiles add column if not exists language text not null default 'en-IN'`);
          const rows = await sql.query<{
            user_id: string;
            shop_name: string;
            phone: string;
            industry: string;
            is_vendor: boolean | string | number;
            vendor_id: string;
          }>(
            `select user_id, shop_name, phone, industry, is_vendor, vendor_id from vaani_profiles`,
          );
          const out: Vendor[] = [];
          const seen = new Set<string>();
          for (const r of rows) {
            const ten = phoneDigits(r.phone || "") || (r.user_id ?? "").match(/(\d{10})$/)?.[1] || "";
            if (ten.length !== 10 || seen.has(ten)) continue;
            if (!String(r.shop_name || "").trim() && r.is_vendor !== true && r.is_vendor !== "t" && r.is_vendor !== "true") {
              continue;
            }
            seen.add(ten);
            const industry = TRADES.includes(r.industry as Industry) ? (r.industry as Industry) : "grocery";
            const display = (r.shop_name || "").trim() || `Shop ${ten}`;
            const id = r.vendor_id || inboxIdForUser(r.user_id || `vaani-${ten}`);
            out.push({
              id,
              name: display,
              shop: display,
              phone: r.phone || `+91 ${ten.slice(0, 5)} ${ten.slice(5)}`,
              city: "",
              industry,
              catalog: [],
              altPhones: [ten, `+91${ten}`, `91${ten}`, `+91 ${ten.slice(0, 5)} ${ten.slice(5)}`],
            });
          }
          return Response.json(out);
        } catch {
          return Response.json([]);
        }
      },
    },
  },
});
