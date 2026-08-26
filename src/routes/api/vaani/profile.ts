import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { inboxIdForUser, phoneDigits } from "@/lib/vaani/seed";

export const Route = createFileRoute("/api/vaani/profile")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const ten = phoneDigits(url.searchParams.get("phone") || "");
          if (ten.length !== 10) return Response.json(null);
          const sql = await getSql();
          const rows = await sql.query<{
            shop_name: string;
            phone: string;
            industry: string;
            is_vendor: boolean | string | number;
            language: string;
          }>(
            `select shop_name, phone, industry, is_vendor, language from vaani_profiles
             where user_id = $1 or phone like $2 limit 1`,
            [`phone:${ten}`, `%${ten}%`],
          );
          const row = rows[0];
          if (!row?.shop_name) return Response.json(null);
          return Response.json({
            shopName: row.shop_name,
            phone: row.phone || `+91 ${ten.slice(0, 5)} ${ten.slice(5)}`,
            industry: row.industry || "",
            isVendor: row.is_vendor === true || row.is_vendor === "t" || row.is_vendor === "true" || row.is_vendor === 1,
            language: row.language || "en-IN",
          });
        } catch {
          return Response.json(null);
        }
      },
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            shopName?: string;
            phone?: string;
            industry?: string;
            isVendor?: boolean;
            language?: string;
          };
          const ten = phoneDigits(body.phone || "");
          const shopName = String(body.shopName || "").trim();
          if (ten.length !== 10 || !shopName) {
            return Response.json({ ok: false }, { status: 400 });
          }
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
          const userId = `phone:${ten}`;
          const vendorId = body.isVendor ? inboxIdForUser(`vaani-${ten}`) : "";
          await sql.query(
            `insert into vaani_profiles (user_id, shop_name, phone, role, vendor_id, industry, is_vendor, language)
             values ($1, $2, $3, $4, $5, $6, $7::boolean, $8)
             on conflict (user_id) do update set
               shop_name = excluded.shop_name,
               phone = excluded.phone,
               industry = excluded.industry,
               is_vendor = excluded.is_vendor,
               vendor_id = excluded.vendor_id,
               language = excluded.language`,
            [
              userId,
              shopName,
              `+91 ${ten.slice(0, 5)} ${ten.slice(5)}`,
              body.isVendor ? "vendor" : "customer",
              vendorId,
              body.industry || "",
              body.isVendor ? "true" : "false",
              body.language || "en-IN",
            ],
          );
          return Response.json({ ok: true, vendorId });
        } catch {
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});
