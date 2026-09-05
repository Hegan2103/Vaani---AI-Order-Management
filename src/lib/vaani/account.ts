import { createHash, randomBytes } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { vaaniGate } from "./gate";
import { getSql, type Sql } from "@/lib/db";
import { inboxIdForUser, phoneDigits } from "./seed";
import type { Industry, Role, Ticket, Vendor } from "./types";

function digits(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) return d.slice(2);
  if (d.length === 11 && d.startsWith("0")) return d.slice(1);
  return d;
}

function phoneEmail(ten: string) {
  return `91${ten}@phone.vaani.app`;
}

async function ensureVaaniSchema(sql: Sql) {
  await sql.query(`
    create table if not exists vaani_otp (
      phone text primary key,
      code_hash text not null,
      expires_at timestamptz not null,
      attempts int not null default 0
    )
  `);
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
  await sql.query(`
    create table if not exists vaani_tickets (
      id text primary key,
      user_id text not null,
      vendor_id text not null default '',
      payload jsonb not null,
      created_at timestamptz not null default now()
    )
  `);
  await sql.query(`alter table vaani_tickets add column if not exists customer_phone text not null default ''`);
  await sql.query(`create index if not exists vaani_tickets_user_idx on vaani_tickets (user_id)`);
  await sql.query(`create index if not exists vaani_tickets_vendor_idx on vaani_tickets (vendor_id)`);
  await sql.query(`
    create table if not exists vaani_push (
      endpoint text primary key,
      phone text not null,
      p256dh text not null,
      auth text not null
    )
  `);
  await sql.query(`create index if not exists vaani_push_phone_idx on vaani_push (phone)`);
  await sql.query(`
    create table if not exists vaani_reminders (
      id text primary key,
      owner_ten text not null,
      contact_ten text not null,
      payload jsonb not null
    )
  `);
  await sql.query(`alter table vaani_reminders add column if not exists notify_both boolean not null default false`);
  await sql.query(`alter table vaani_reminders add column if not exists fired_stamp text not null default ''`);
  await sql.query(`
    create table if not exists vaani_inbox (
      id text primary key,
      phone text not null,
      title text not null default '',
      body text not null default '',
      ticket_id text not null default '',
      created_at timestamptz not null default now()
    )
  `);
  await sql.query(`create index if not exists vaani_inbox_phone_idx on vaani_inbox (phone)`);
  await sql.query(`
    create table if not exists vaani_phonebook (
      phone text primary key,
      names jsonb not null default '{}'::jsonb
    )
  `);
}

async function createPhoneSession(ten: string) {
  const sql = await getSql();
  await ensureVaaniSchema(sql);
  const email = phoneEmail(ten);
  const phone = `+91 ${ten.slice(0, 5)} ${ten.slice(5)}`;
  const name = `Shop ${ten}`;
  const userId = `vaani-${ten}`;
  const sessionToken = randomBytes(32).toString("base64url");
  const sessionId = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const existing = await sql.query<{ id: string }>(
    `select id from "user" where email = $1 or id = $2 limit 1`,
    [email, userId],
  );
  const uid = existing[0]?.id || userId;
  if (!existing[0]) {
    await sql.query(
      `insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
       values ($1, $2, $3, true, now(), now())
       on conflict (id) do update set name = excluded.name, "updatedAt" = now()`,
      [uid, name, email],
    );
  } else {
    await sql.query(`update "user" set name = $1, email = $2, "updatedAt" = now() where id = $3`, [
      name,
      email,
      uid,
    ]);
  }
  await sql.query(
    `insert into "session" (id, "expiresAt", token, "createdAt", "updatedAt", "userId")
     values ($1, $2::timestamptz, $3, now(), now(), $4)`,
    [sessionId, expiresAt, sessionToken, uid],
  );
  return { token: sessionToken, email, phone, name, userId: uid };
}

export const signInWithMobile = createServerFn({ method: "POST" })
  .validator((input: { phone: string }) => input)
  .handler(async ({ data }) => {
    const ten = digits(data.phone);
    if (ten.length !== 10) return { ok: false as const, error: "Enter a 10-digit Indian mobile number." };
    try {
      const session = await createPhoneSession(ten);
      return { ok: true as const, ...session };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not start session.";
      return { ok: false as const, error: msg };
    }
  });

export const sendOtp = createServerFn({ method: "POST" })
  .validator((input: { phone: string }) => input)
  .handler(async ({ data }) => {
    const ten = digits(data.phone);
    if (ten.length !== 10) return { ok: false as const, error: "Enter a 10-digit Indian mobile number." };
    const sql = await getSql();
    await ensureVaaniSchema(sql);
    const n = randomBytes(3).readUIntBE(0, 3) % 900000;
    const code = String(100000 + n);
    const hash = createHash("sha256").update(`${ten}:${code}`).digest("hex");
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await sql.query(
      `insert into vaani_otp (phone, code_hash, expires_at, attempts)
       values ($1, $2, $3::timestamptz, 0)
       on conflict (phone) do update set code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0`,
      [ten, hash, expires],
    );
    return { ok: true as const, previewCode: code };
  });

export const verifyOtp = createServerFn({ method: "POST" })
  .validator((input: { phone: string; code: string }) => input)
  .handler(async ({ data }) => {
    const ten = digits(data.phone);
    const code = String(data.code ?? "").replace(/\D/g, "").slice(0, 6);
    if (ten.length !== 10) return { ok: false as const, error: "Enter a 10-digit Indian mobile number." };
    if (code.length !== 6) return { ok: false as const, error: "Enter the 6-digit code." };
    const sql = await getSql();
    await ensureVaaniSchema(sql);
    const rows = await sql.query<{ code_hash: string; expires_at: string | Date; attempts: number }>(
      `select code_hash, expires_at, attempts from vaani_otp where phone = $1`,
      [ten],
    );
    const row = rows[0];
    if (!row) return { ok: false as const, error: "Request a new code." };
    if (Number(row.attempts) >= 5) return { ok: false as const, error: "Too many tries. Request a new code." };
    if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false as const, error: "Code expired. Request a new code." };
    const hash = createHash("sha256").update(`${ten}:${code}`).digest("hex");
    if (hash !== row.code_hash) {
      await sql.query(`update vaani_otp set attempts = attempts + 1 where phone = $1`, [ten]);
      return { ok: false as const, error: "Wrong code. Try again." };
    }
    await sql.query(`delete from vaani_otp where phone = $1`, [ten]);
    try {
      const session = await createPhoneSession(ten);
      return { ok: true as const, ...session };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not start session.";
      return { ok: false as const, error: msg };
    }
  });

export const listPublicVendors = createServerFn({ method: "GET" })
  .middleware([vaaniGate])
  .handler(async () => {
    const sql = await getSql();
    await ensureVaaniSchema(sql);
    const rows = await sql.query<{
      user_id: string;
      shop_name: string;
      phone: string;
      industry: string;
      is_vendor: boolean | string | number;
      role: string;
    }>(`select user_id, shop_name, phone, industry, is_vendor, role from vaani_profiles`);
    return rows
      .map((r) => {
        const fromUser = digits(String(r.user_id || "").replace(/^vaani-/, ""));
        const fromPhone = digits(r.phone || "");
        const ten =
          fromUser.length === 10 ? fromUser : fromPhone.length >= 10 ? fromPhone.slice(-10) : fromPhone;
        const flag =
          r.is_vendor === true ||
          r.is_vendor === "t" ||
          r.is_vendor === "true" ||
          r.is_vendor === 1;
        return {
          ten,
          shopName: (r.shop_name || "").trim(),
          industry: (r.industry || "") as Industry | "",
          isVendor: flag,
        };
      })
      .filter((r) => r.ten.length === 10 && r.shopName);
  });

export const lookupVendorByPhone = createServerFn({ method: "POST" })
  .middleware([vaaniGate])
  .validator((input: { phone: string }) => input)
  .handler(async ({ data }) => {
    const ten = digits(data.phone);
    if (ten.length !== 10) return null;
    const sql = await getSql();
    await ensureVaaniSchema(sql);
    const rows = await sql.query<{ user_id: string; shop_name: string; phone: string; industry: string; is_vendor: boolean | string | number }>(
      `select user_id, shop_name, phone, industry, is_vendor from vaani_profiles`,
    );
    const hit = rows.find((r) => {
      const u = digits(String(r.user_id || "").replace(/^vaani-/, ""));
      const p = digits(r.phone || "");
      return u === ten || p.slice(-10) === ten;
    });
    const shopName = (hit?.shop_name || "").trim();
    if (!hit || !shopName) return null;
    const isVendor = hit.is_vendor === true || hit.is_vendor === "t" || hit.is_vendor === "true" || hit.is_vendor === 1;
    if (!isVendor) return { ten, shopName, industry: (hit.industry || "") as Industry | "", isVendor: false as const };
    return { ten, shopName, industry: (hit.industry || "") as Industry | "", isVendor: true as const };
  });

export const loadProfile = createServerFn({ method: "GET" })
  .middleware([vaaniGate])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureVaaniSchema(sql);
    const rows = await sql<{
      shop_name: string;
      phone: string;
      role: string;
      vendor_id: string;
      industry: string;
      is_vendor: boolean | string | number;
      language: string;
    }>`
      select shop_name, phone, role, vendor_id, industry, is_vendor, language
      from vaani_profiles where user_id = ${context.userId}
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      ...row,
      is_vendor: row.is_vendor === true || row.is_vendor === "t" || row.is_vendor === "true" || row.is_vendor === 1,
      language: row.language || "en-IN",
    };
  });

function parseTicket(payload: Ticket | string): Ticket {
  return typeof payload === "string" ? (JSON.parse(payload) as Ticket) : payload;
}

export const loadAccount = createServerFn({ method: "POST" })
  .middleware([vaaniGate])
  .validator((input: { phone?: string } = {}) => input ?? {})
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureVaaniSchema(sql);

    let emailTen = digits(data?.phone ?? "");
    if (emailTen.length === 12 && emailTen.startsWith("91")) emailTen = emailTen.slice(2);
    if (emailTen.length !== 10) {
      try {
        const users = await sql.query<{ email: string }>(`select email from "user" where id = $1`, [context.userId]);
        emailTen = digits(users[0]?.email ?? "");
        if (emailTen.length === 12 && emailTen.startsWith("91")) emailTen = emailTen.slice(2);
      } catch {
        emailTen = "";
      }
    }

    const profiles = await sql.query<{
      user_id: string;
      shop_name: string;
      phone: string;
      role: string;
      vendor_id: string;
      industry: string;
      is_vendor: boolean | string | number;
      language: string;
    }>(`select user_id, shop_name, phone, role, vendor_id, industry, is_vendor, language from vaani_profiles`);

    const asFlag = (v: boolean | string | number) =>
      v === true || v === "t" || v === "true" || v === 1;

    const tenOf = (value: string) => {
      const d = digits(value);
      if (d.length === 12 && d.startsWith("91")) return d.slice(2);
      return d.length >= 10 ? d.slice(-10) : d;
    };

    const mine = profiles.filter((p) => p.user_id === context.userId);
    const byPhone = emailTen
      ? profiles.filter((p) => {
          const t = digits(p.phone);
          const ten = t.length === 12 && t.startsWith("91") ? t.slice(2) : t;
          return ten === emailTen;
        })
      : [];
    const richest =
      [...mine, ...byPhone].sort((a, b) => (b.shop_name?.trim().length ?? 0) - (a.shop_name?.trim().length ?? 0))[0] ??
      null;

    if (richest && richest.user_id !== context.userId && richest.shop_name.trim()) {
      const newInbox = inboxIdForUser(context.userId);
      const oldInbox = richest.vendor_id || inboxIdForUser(richest.user_id);
      await sql.query(
        `insert into vaani_profiles (user_id, shop_name, phone, role, vendor_id, industry, is_vendor, language)
         values ($1, $2, $3, $4, $5, $6, $7::boolean, $8)
         on conflict (user_id) do update set
           shop_name = case when vaani_profiles.shop_name = '' then excluded.shop_name else vaani_profiles.shop_name end,
           phone = case when vaani_profiles.phone = '' then excluded.phone else vaani_profiles.phone end,
           industry = case when vaani_profiles.industry = '' then excluded.industry else vaani_profiles.industry end,
           is_vendor = vaani_profiles.is_vendor or excluded.is_vendor,
           vendor_id = case when vaani_profiles.vendor_id = '' then excluded.vendor_id else vaani_profiles.vendor_id end,
           language = excluded.language`,
        [
          context.userId,
          richest.shop_name,
          richest.phone,
          richest.role,
          richest.vendor_id || newInbox,
          richest.industry,
          asFlag(richest.is_vendor) ? "true" : "false",
          richest.language || "en-IN",
        ],
      );
      await sql.query(`update vaani_tickets set user_id = $1 where user_id = $2`, [context.userId, richest.user_id]);
      if (oldInbox && oldInbox !== newInbox) {
        await sql.query(`update vaani_tickets set vendor_id = $1 where vendor_id = $2`, [newInbox, oldInbox]);
      }
    }

    const latest = await sql.query<{
      shop_name: string;
      phone: string;
      role: string;
      vendor_id: string;
      industry: string;
      is_vendor: boolean | string | number;
      language: string;
    }>(
      `select shop_name, phone, role, vendor_id, industry, is_vendor, language from vaani_profiles where user_id = $1`,
      [context.userId],
    );
    const row = latest[0] ?? richest;
    const profile = row
      ? {
          shop_name: row.shop_name,
          phone: row.phone,
          role: row.role,
          vendor_id: row.vendor_id,
          industry: row.industry,
          is_vendor: asFlag(row.is_vendor),
          language: row.language || "en-IN",
        }
      : null;

    const vendorId = profile?.vendor_id || inboxIdForUser(context.userId);
    const relatedIds = new Set<string>([context.userId, ...byPhone.map((p) => p.user_id)]);
    if (richest?.user_id) relatedIds.add(richest.user_id);
    try {
      const authUsers = await sql.query<{ id: string; email: string }>(`select id, email from "user"`);
      for (const u of authUsers) {
        if (emailTen && tenOf(u.email) === emailTen) relatedIds.add(u.id);
      }
    } catch {
      /* user table may not exist yet */
    }
    const ticketRows = await sql.query<{ user_id: string; vendor_id: string; payload: Ticket | string; customer_phone?: string }>(
      `select user_id, vendor_id, payload, customer_phone from vaani_tickets`,
    );
    const parsed = ticketRows.map((r) => ({
      user_id: r.user_id,
      vendor_id: r.vendor_id,
      ticket: parseTicket(r.payload),
    }));
    const tickets = parsed
      .filter((r) => {
        if (relatedIds.has(r.user_id)) return true;
        if (!emailTen) return false;
        return tenOf(r.ticket.customerPhone || "") === emailTen;
      })
      .map((r) => r.ticket);
    const inboxIds = new Set<string>([vendorId, ...byPhone.map((p) => p.vendor_id).filter(Boolean)]);
    if (richest?.vendor_id) inboxIds.add(richest.vendor_id);
    const incoming = parsed
      .filter((r) => inboxIds.has(r.vendor_id))
      .filter((r) => !emailTen || tenOf(r.ticket.customerPhone || "") !== emailTen)
      .map((r) => r.ticket);

    return {
      userId: context.userId,
      profile,
      tickets,
      incoming,
    };
  });

export const saveProfile = createServerFn({ method: "POST" })
  .middleware([vaaniGate])
  .validator(
    (input: {
      shopName: string;
      phone: string;
      role: Role;
      vendorId?: string;
      industry?: string;
      isVendor?: boolean;
      language?: string;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const shopName = data.shopName.trim();
    if (!shopName) return { ok: false as const, error: "Shop name cannot be empty." };
    const ten = digits(data.phone) || digits(String(context.userId || "").replace(/^vaani-/, ""));
    const userId = context.userId || (ten.length === 10 ? `vaani-${ten}` : "");
    if (!userId) return { ok: false as const, error: "Sign in again, then save shop." };
    const sql = await getSql();
    await ensureVaaniSchema(sql);
    const existing = await sql<{ phone: string }>`
      select phone from vaani_profiles where user_id = ${userId}
    `;
    const phone = data.phone.trim() || existing[0]?.phone || (ten.length === 10 ? ten : "");
    const vendorId = data.isVendor ? inboxIdForUser(userId) : (data.vendorId ?? "");
    const industry = data.industry ?? "";
    const flag = data.isVendor ? "true" : "false";
    const language = data.language || "en-IN";
    try {
      await sql.query(
        `insert into vaani_profiles (user_id, shop_name, phone, role, vendor_id, industry, is_vendor, language)
         values ($1, $2, $3, $4, $5, $6, $7::boolean, $8)
         on conflict (user_id) do update set
           shop_name = excluded.shop_name,
           phone = excluded.phone,
           role = excluded.role,
           industry = excluded.industry,
           is_vendor = excluded.is_vendor,
           vendor_id = excluded.vendor_id,
           language = excluded.language`,
        [userId, shopName, phone, data.role, vendorId, industry, flag, language],
      );
      return { ok: true as const, vendorId };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not save shop details.";
      return { ok: false as const, error: msg };
    }
  });

export const saveLanguage = createServerFn({ method: "POST" })
  .middleware([vaaniGate])
  .validator((input: { language: string }) => input)
  .handler(async ({ context, data }) => {
    const language = data.language.trim() || "en-IN";
    const sql = await getSql();
    await ensureVaaniSchema(sql);
    await sql.query(
      `insert into vaani_profiles (user_id, shop_name, phone, role, vendor_id, industry, is_vendor, language)
       values ($1, '', '', 'customer', '', '', false, $2)
       on conflict (user_id) do update set language = excluded.language`,
      [context.userId, language],
    );
    return { ok: true as const };
  });

export const rememberLoginPhone = createServerFn({ method: "POST" })
  .middleware([vaaniGate])
  .validator((input: { phone: string }) => input)
  .handler(async ({ context, data }) => {
    const ten = phoneDigits(data.phone);
    if (ten.length !== 10) return { ok: false as const };
    const formatted = `+91 ${ten.slice(0, 5)} ${ten.slice(5)}`;
    const sql = await getSql();
    await ensureVaaniSchema(sql);
    const existing = await sql.query<{
      user_id: string;
      shop_name: string;
      phone: string;
      role: string;
      vendor_id: string;
      industry: string;
      is_vendor: boolean | string | number;
      language: string;
    }>(`select user_id, shop_name, phone, role, vendor_id, industry, is_vendor, language from vaani_profiles`);
    const match = existing.find((p) => {
      const t = digits(p.phone);
      const pten = t.length === 12 && t.startsWith("91") ? t.slice(2) : t;
      return pten === ten && Boolean(p.shop_name?.trim());
    });
    const shop = match?.shop_name ?? "";
    const industry = match?.industry ?? "";
    const role = match?.role || "customer";
    const isVendor = match
      ? match.is_vendor === true || match.is_vendor === "t" || match.is_vendor === "true" || match.is_vendor === 1
      : false;
    const language = match?.language || "en-IN";
    const vendorId = match?.vendor_id || (isVendor ? inboxIdForUser(context.userId) : "");
    await sql.query(
      `insert into vaani_profiles (user_id, shop_name, phone, role, vendor_id, industry, is_vendor, language)
       values ($1, $2, $3, $4, $5, $6, $7::boolean, $8)
       on conflict (user_id) do update set
         phone = case when vaani_profiles.phone = '' then excluded.phone else vaani_profiles.phone end,
         shop_name = case when vaani_profiles.shop_name = '' then excluded.shop_name else vaani_profiles.shop_name end,
         industry = case when vaani_profiles.industry = '' then excluded.industry else vaani_profiles.industry end,
         is_vendor = vaani_profiles.is_vendor or excluded.is_vendor,
         vendor_id = case when vaani_profiles.vendor_id = '' then excluded.vendor_id else vaani_profiles.vendor_id end`,
      [context.userId, shop, formatted, role, vendorId, industry, isVendor ? "true" : "false", language],
    );
    if (match && match.user_id !== context.userId) {
      await sql.query(`update vaani_tickets set user_id = $1 where user_id = $2`, [context.userId, match.user_id]);
    }
    return { ok: true as const, phone: formatted };
  });

export const listRegisteredVendors = createServerFn({ method: "GET" })
  .middleware([vaaniGate])
  .handler(async () => {
    const sql = await getSql();
    await ensureVaaniSchema(sql);
    const rows = await sql.query<{
      user_id: string;
      shop_name: string;
      phone: string;
      industry: string;
      is_vendor: boolean | string | number;
      vendor_id: string;
      email: string | null;
    }>(
      `select p.user_id, p.shop_name, p.phone, p.industry, p.is_vendor, p.vendor_id, u.email
       from vaani_profiles p
       left join "user" u on u.id = p.user_id`,
    );
    const trades: Industry[] = [
      "pharmaceutical",
      "grocery",
      "electrical",
      "hardware",
      "construction",
      "electronics",
    ];
    const out: Vendor[] = [];
    for (const r of rows) {
      const emailTen = (r.email ?? "").match(/^91(\d{10})@/i)?.[1] ?? "";
      const idTen = (r.user_id ?? "").match(/(\d{10})$/)?.[1] ?? "";
      const ten = phoneDigits(r.phone) || emailTen || idTen;
      if (ten.length !== 10) continue;
      const industry = trades.includes(r.industry as Industry) ? (r.industry as Industry) : "grocery";
      const id = r.vendor_id || inboxIdForUser(r.user_id || `vaani-${ten}`);
      const display = (r.shop_name || "").trim() || `Shop ${ten}`;
      out.push({
        id,
        name: display,
        shop: display,
        phone: r.phone || `+91 ${ten.slice(0, 5)} ${ten.slice(5)}`,
        city: "",
        industry,
        catalog: [],
        altPhones: [`+91${ten}`, `91${ten}`, ten, `+91 ${ten.slice(0, 5)} ${ten.slice(5)}`],
      });
    }
    const users = await sql.query<{ id: string; email: string; name: string }>(
      `select id, email, name from "user"`,
    );
    const seen = new Set(out.flatMap((v) => (v.altPhones ?? []).map((p) => phoneDigits(p))));
    for (const u of users) {
      const ten = (u.email ?? "").match(/^91(\d{10})@/i)?.[1] ?? "";
      if (ten.length !== 10 || seen.has(ten)) continue;
      seen.add(ten);
      out.push({
        id: inboxIdForUser(u.id),
        name: u.name || `Shop ${ten}`,
        shop: u.name || `Shop ${ten}`,
        phone: `+91 ${ten.slice(0, 5)} ${ten.slice(5)}`,
        city: "",
        industry: "grocery",
        catalog: [],
        altPhones: [`+91${ten}`, `91${ten}`, ten],
      });
    }
    return out;
  });

export const claimVendorShop = createServerFn({ method: "POST" })
  .middleware([vaaniGate])
  .validator((input: { vendorId: string }) => input)
  .handler(async ({ context, data }) => {
    const vendorId = data.vendorId.trim();
    if (!vendorId) return { ok: false as const, error: "Pick the shop you run." };
    const sql = await getSql();
    await sql`
      insert into vaani_profiles (user_id, shop_name, phone, role, vendor_id)
      values (${context.userId}, '', '', 'vendor', ${vendorId})
      on conflict (user_id) do update set role = 'vendor', vendor_id = excluded.vendor_id
    `;
    return { ok: true as const };
  });

export const openVendorInbox = createServerFn({ method: "POST" })
  .middleware([vaaniGate])
  .validator((input: { vendorId?: string; phone?: string; industry?: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureVaaniSchema(sql);
    const profile = await sql<{
      shop_name: string;
      phone: string;
      industry: string;
      is_vendor: boolean;
      vendor_id: string;
    }>`
      select shop_name, phone, industry, is_vendor, vendor_id from vaani_profiles
      where user_id = ${context.userId}
    `;
    const row = profile[0];
    const industry = (data.industry || row?.industry || "") as Industry | "";
    const inboxId = inboxIdForUser(context.userId);
    if (!industry) {
      return {
        ok: false as const,
        error: "Save your shop and pick the trade you sell in.",
        vendorId: "",
        tickets: [] as Ticket[],
        industry: "",
        shopName: row?.shop_name ?? "",
      };
    }
    await sql`
      insert into vaani_profiles (user_id, shop_name, phone, role, vendor_id, industry, is_vendor)
      values (${context.userId}, ${row?.shop_name ?? ""}, ${data.phone || row?.phone || ""}, 'vendor', ${inboxId}, ${industry}, true)
      on conflict (user_id) do update set
        role = 'vendor',
        vendor_id = ${inboxId},
        industry = ${industry},
        is_vendor = true,
        shop_name = case when vaani_profiles.shop_name = '' then excluded.shop_name else vaani_profiles.shop_name end,
        phone = case when vaani_profiles.phone = '' then excluded.phone else vaani_profiles.phone end
    `;
    const rows = await sql<{ payload: Ticket | string }>`
      select payload from vaani_tickets
      where vendor_id = ${inboxId}
      order by created_at desc
    `;
    const tickets = rows
      .map((r) => parseTicket(r.payload))
      .filter((t) => {
        const buyer = phoneDigits(t.customerPhone);
        const mine = phoneDigits(data.phone || row?.phone || "");
        return !mine || buyer !== mine;
      });
    return {
      ok: true as const,
      vendorId: inboxId,
      tickets,
      industry,
      shopName: row?.shop_name ?? "",
    };
  });

export const saveTicket = createServerFn({ method: "POST" })
  .middleware([vaaniGate])
  .validator((input: { ticket: Ticket }) => input)
  .handler(async ({ context, data }) => {
    const t = data.ticket;
    const sql = await getSql();
    await ensureVaaniSchema(sql);
    const vendorTen =
      digits(t.vendorPhone || "") || String(t.vendorId || "").match(/(\d{10})/)?.[1] || "";
    const vendorId = vendorTen.length === 10 ? inboxIdForUser(`vaani-${vendorTen}`) : t.vendorId;
    const buyerTen = digits(t.customerPhone);
    const loginTen = digits(String(context.userId || "").replace(/^vaani-/, ""));
    const userId = context.userId || (buyerTen.length === 10 ? `vaani-${buyerTen}` : "");
    const stamped = {
      ...t,
      vendorId,
      vendorPhone: t.vendorPhone || (vendorTen.length === 10 ? vendorTen : t.vendorPhone),
      customerPhone: t.customerPhone || buyerTen,
    };
    const profile = await sql<{ vendor_id: string }>`
      select vendor_id from vaani_profiles where user_id = ${userId || context.userId}
    `;
    const claimed = profile[0]?.vendor_id ?? "";
    const existing = await sql<{ user_id: string; vendor_id: string }>`
      select user_id, vendor_id from vaani_tickets where id = ${t.id}
    `;
    const payload = JSON.stringify({ ...stamped, updatedAt: t.updatedAt || new Date().toISOString() });
    try {
    if (existing[0]) {
      const row = existing[0];
      const allowed =
        row.user_id === userId ||
        row.user_id === context.userId ||
        row.vendor_id === vendorId ||
        row.vendor_id === t.vendorId ||
        (loginTen.length === 10 && String(row.vendor_id || "").includes(loginTen)) ||
        (claimed !== "" && row.vendor_id === claimed);
      if (!allowed) return { ok: false as const, error: "Could not update this list." };
      await sql.query(`update vaani_tickets set payload = $1::jsonb, vendor_id = $2, customer_phone = $3 where id = $4`, [
        payload,
        vendorId,
        digits(t.customerPhone),
        t.id,
      ]);
    } else {
      await sql.query(
        `insert into vaani_tickets (id, user_id, vendor_id, payload, customer_phone) values ($1, $2, $3, $4::jsonb, $5)`,
        [t.id, userId, vendorId, payload, buyerTen],
      );
    }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not save.";
      return { ok: false as const, error: msg };
    }
    try {
      const { sendPushToPhones } = await import("./push-server");
      const saver = digits(String(context.userId || "").replace(/^vaani-/, ""));
      const buyer = digits(t.customerPhone);
      const targets: string[] = [];
      const vendorActed = t.lines.some((l) =>
        l.status === "rejected" || l.status === "accepted" || l.status === "quoted" || l.status === "confirmed",
      );
      if (t.status !== "draft") {
        if (vendorActed && buyer && buyer !== vendorTen) targets.push(buyer);
        else if (saver === buyer && vendorTen && vendorTen !== buyer) targets.push(vendorTen);
        else if (vendorTen && vendorTen !== buyer && vendorTen !== saver) targets.push(vendorTen);
      }
      const title =
        t.status === "finalized"
          ? "Order copy ready"
          : t.status === "draft"
            ? "Draft saved"
            : existing[0]
              ? "Order updated"
              : "New order";
      const body = `${t.customerName || "Shop"} · ${t.lines.length} lines`;
      const url = t.status === "finalized" ? `/copy/${t.id}` : `/ticket/${t.id}`;
      if (targets.length) await sendPushToPhones(targets, title, body, url);
    } catch {
      /* in-app bell still works */
    }
    return { ok: true as const };
  });

export const listIncomingTickets = createServerFn({ method: "POST" })
  .middleware([vaaniGate])
  .validator((input: { vendorId: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureVaaniSchema(sql);
    const loginTen = digits(String(context.userId || "").replace(/^vaani-/, ""));
    const profile = await sql<{ phone: string }>`
      select phone from vaani_profiles where user_id = ${context.userId}
    `;
    const mine = loginTen.length === 10 ? loginTen : phoneDigits(profile[0]?.phone || "");
    const myInbox = loginTen.length === 10 ? inboxIdForUser(`vaani-${loginTen}`) : data.vendorId;
    const rows = await sql.query<{ payload: Ticket | string; vendor_id: string }>(
      `select payload, vendor_id from vaani_tickets order by created_at desc`,
    );
    const out: Ticket[] = [];
    for (const r of rows) {
      let ticket: Ticket;
      try {
        ticket = parseTicket(r.payload);
      } catch {
        continue;
      }
      if (ticket.status === "draft") continue;
      const vTen =
        digits(ticket.vendorPhone || "") || String(r.vendor_id || ticket.vendorId || "").match(/(\d{10})/)?.[1] || "";
      const forMe =
        r.vendor_id === data.vendorId ||
        r.vendor_id === myInbox ||
        ticket.vendorId === data.vendorId ||
        ticket.vendorId === myInbox ||
        (mine.length === 10 && vTen === mine) ||
        (mine.length === 10 && String(r.vendor_id || "").includes(mine));
      if (!forMe) continue;
      if (mine && phoneDigits(ticket.customerPhone) === mine) continue;
      out.push(ticket);
    }
    return out;
  });

export const listTickets = createServerFn({ method: "GET" })
  .middleware([vaaniGate])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureVaaniSchema(sql);
    const loginTen = digits(String(context.userId || "").replace(/^vaani-/, ""));
    const rows = await sql.query<{ payload: Ticket | string }>(
      loginTen.length === 10
        ? `select payload from vaani_tickets where user_id = $1 or customer_phone = $2 order by created_at desc`
        : `select payload from vaani_tickets where user_id = $1 order by created_at desc`,
      loginTen.length === 10 ? [context.userId, loginTen] : [context.userId],
    );
    return rows.map((r) => parseTicket(r.payload));
  });

export const getTicket = createServerFn({ method: "POST" })
  .middleware([vaaniGate])
  .validator((input: { id: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const loginTen = digits(String(context.userId || "").replace(/^vaani-/, ""));
    const myInbox = loginTen.length === 10 ? inboxIdForUser(`vaani-${loginTen}`) : "";
    const profile = await sql<{ vendor_id: string }>`
      select vendor_id from vaani_profiles where user_id = ${context.userId}
    `;
    const claimed = profile[0]?.vendor_id ?? "";
    const rows = await sql.query<{ payload: Ticket | string; user_id: string; vendor_id: string; customer_phone: string }>(
      `select payload, user_id, vendor_id, customer_phone from vaani_tickets where id = $1`,
      [data.id],
    );
    const row = rows[0];
    if (!row) return null;
    const ticket = parseTicket(row.payload);
    const buyer = digits(ticket.customerPhone || row.customer_phone || "");
    const allowed =
      row.user_id === context.userId ||
      (claimed !== "" && row.vendor_id === claimed) ||
      row.vendor_id === myInbox ||
      (loginTen.length === 10 && (buyer === loginTen || String(row.vendor_id || "").includes(loginTen)));
    if (!allowed) return null;
    return ticket;
  });

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([vaaniGate])
  .validator((input: { phone: string; endpoint: string; p256dh: string; auth: string }) => input)
  .handler(async ({ data }) => {
    const ten = digits(data.phone);
    if (ten.length !== 10 || !data.endpoint || !data.p256dh || !data.auth) {
      return { ok: false as const };
    }
    const sql = await getSql();
    await ensureVaaniSchema(sql);
    await sql.query(
      `insert into vaani_push (endpoint, phone, p256dh, auth) values ($1, $2, $3, $4)
       on conflict (endpoint) do update set phone = excluded.phone, p256dh = excluded.p256dh, auth = excluded.auth`,
      [data.endpoint, ten, data.p256dh, data.auth],
    );
    return { ok: true as const };
  });

export const saveReminder = createServerFn({ method: "POST" })
  .middleware([vaaniGate])
  .validator((input: { reminder: import("./types").Reminder }) => input)
  .handler(async ({ data }) => {
    const r = data.reminder;
    const sql = await getSql();
    await ensureVaaniSchema(sql);
    const both = Boolean(r.notifyBoth);
    const payload = JSON.stringify({ ...r, notifyBoth: both });
    const owner = digits(r.ownerTen);
    const contact = digits(r.contactTen);
    try {
      await sql.query(
        `delete from vaani_reminders where owner_ten = $1 and contact_ten = $2 and id <> $3 and coalesce(notify_both, false) = $4`,
        [owner, contact, r.id, both],
      );
    } catch {
      /* keep going */
    }
    try {
      await sql.query(
        `insert into vaani_reminders (id, owner_ten, contact_ten, payload, notify_both, fired_stamp) values ($1, $2, $3, $4::jsonb, $5, '')
         on conflict (id) do update set owner_ten = excluded.owner_ten, contact_ten = excluded.contact_ten, payload = excluded.payload, notify_both = excluded.notify_both, fired_stamp = ''`,
        [r.id, owner, contact, payload, both],
      );
    } catch {
      await sql.query(
        `insert into vaani_reminders (id, owner_ten, contact_ten, payload) values ($1, $2, $3, $4::jsonb)
         on conflict (id) do update set owner_ten = excluded.owner_ten, contact_ten = excluded.contact_ten, payload = excluded.payload`,
        [r.id, digits(r.ownerTen), digits(r.contactTen), payload],
      );
    }
    return { ok: true as const };
  });

export const deleteReminderRemote = createServerFn({ method: "POST" })
  .middleware([vaaniGate])
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const sql = await getSql();
    await ensureVaaniSchema(sql);
    await sql.query(`delete from vaani_reminders where id = $1`, [data.id]);
    return { ok: true as const };
  });

export const listRemindersRemote = createServerFn({ method: "POST" })
  .middleware([vaaniGate])
  .validator((input: { phone: string }) => input)
  .handler(async ({ data }) => {
    const ten = digits(data.phone);
    if (ten.length !== 10) return [];
    const sql = await getSql();
    await ensureVaaniSchema(sql);
    let rows: {
      payload: unknown;
      owner_ten?: string;
      contact_ten?: string;
      notify_both?: boolean | string | number;
    }[] = [];
    try {
      rows = await sql.query(
        `select payload, owner_ten, contact_ten, notify_both from vaani_reminders where owner_ten = $1 or contact_ten = $1`,
        [ten],
      );
    } catch {
      rows = await sql.query(
        `select payload, owner_ten, contact_ten from vaani_reminders where owner_ten = $1 or contact_ten = $1`,
        [ten],
      );
    }
    return rows.map((row) => {
      let raw: Record<string, unknown> = {};
      try {
        const p = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload;
        if (p && typeof p === "object") raw = p as Record<string, unknown>;
      } catch {
        raw = {};
      }
      const both =
        raw.notifyBoth === true ||
        row.notify_both === true ||
        row.notify_both === "t" ||
        row.notify_both === "true" ||
        row.notify_both === 1;
      return {
        ...raw,
        ownerTen: digits(String(raw.ownerTen || row.owner_ten || "")),
        contactTen: digits(String(raw.contactTen || row.contact_ten || "")),
        notifyBoth: both,
        bells: (raw.bells && typeof raw.bells === "object" ? raw.bells : {}) as Record<string, string>,
      };
    });
  });


export const listInboxNotices = createServerFn({ method: "POST" })
  .middleware([vaaniGate])
  .validator((input: { phone: string }) => input)
  .handler(async ({ data }) => {
    const ten = digits(data.phone);
    if (ten.length !== 10) return [];
    const sql = await getSql();
    await ensureVaaniSchema(sql);
    const rows = await sql.query<{
      id: string;
      title: string;
      body: string;
      ticket_id: string;
      created_at: string;
    }>(
      `select id, title, body, ticket_id, created_at from vaani_inbox where phone = $1 and created_at > now() - interval '7 days' order by created_at desc limit 40`,
      [ten],
    );
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      ticketId: row.ticket_id || `reminder:${row.id}`,
      at: new Date(row.created_at).toISOString(),
    }));
  });


function kolkataNow() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return {
    stamp: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
    day: day < 0 ? new Date().getDay() : day,
  };
}

function reminderIsDue(row: { lastFired?: string; time?: string; repeat?: string; weekday?: number; date?: string; from?: string; to?: string }) {
  const now = kolkataNow();
  if ((row.lastFired || "") === now.stamp) return false;
  const [h, m] = String(row.time || "09:00").split(":").map((n) => Number(n));
  const atMin = (h || 0) * 60 + (m || 0);
  if (now.minutes < atMin) return false;
  if (now.minutes > atMin + 5) return false;
  if (row.repeat === "weekly") return now.day === (row.weekday ?? 1);
  if (row.repeat === "once") return (row.date || "") === now.stamp;
  if (row.repeat === "range") return now.stamp >= (row.from || now.stamp) && now.stamp <= (row.to || now.stamp);
  return true;
}

export const processDueReminders = createServerFn({ method: "POST" })
  .middleware([vaaniGate])
  .validator((input: { phone: string; book?: Record<string, string> }) => input)
  .handler(async ({ data }) => {
    const ten = digits(data.phone);
    const book = data.book && typeof data.book === "object" ? data.book : {};
    if (ten.length !== 10) return { fired: 0 };
    const sql = await getSql();
    await ensureVaaniSchema(sql);
    if (book && Object.keys(book).length) {
      try {
        await sql.query(
          `insert into vaani_phonebook (phone, names) values ($1, $2::jsonb)
           on conflict (phone) do update set names = vaani_phonebook.names || excluded.names`,
          [ten, JSON.stringify(book)],
        );
      } catch {
        /* optional */
      }
    }
    let rows: { id: string; owner_ten: string; contact_ten: string; payload: unknown; notify_both?: boolean }[] = [];
    try {
      rows = await sql.query(
        `select id, owner_ten, contact_ten, payload, notify_both from vaani_reminders where owner_ten = $1 or contact_ten = $1`,
        [ten],
      );
    } catch {
      rows = await sql.query(
        `select id, owner_ten, contact_ten, payload from vaani_reminders where owner_ten = $1 or contact_ten = $1`,
        [ten],
      );
    }
    const { sendPushToPhones } = await import("./push-server");
    let fired = 0;
    const notices: { id: string; title: string; body: string; ticketId: string }[] = [];
    const stamp = kolkataNow().stamp;
    const latest = new Map<string, { created: string; id: string }>();
    for (const row of rows) {
      let created = "";
      try {
        const p = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload;
        created = String((p as { createdAt?: string })?.createdAt || "");
      } catch {
        created = "";
      }
      const key = `${digits(row.owner_ten)}:${digits(row.contact_ten)}:${row.notify_both ? "both" : "self"}`;
      const prev = latest.get(key);
      if (!prev || created > prev.created) latest.set(key, { created, id: row.id });
    }
    for (const row of rows) {
      const key = `${digits(row.owner_ten)}:${digits(row.contact_ten)}:${row.notify_both ? "both" : "self"}`;
      if (latest.get(key)?.id !== row.id) continue;
      let raw: Record<string, unknown> = {};
      try {
        const p = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload;
        if (p && typeof p === "object") raw = p as Record<string, unknown>;
      } catch {
        raw = {};
      }
      const reminder = {
        ...raw,
        lastFired: String(raw.lastFired || ""),
        time: String(raw.time || "09:00"),
        repeat: String(raw.repeat || "daily"),
        weekday: Number(raw.weekday ?? 1),
        date: String(raw.date || ""),
        from: String(raw.from || ""),
        to: String(raw.to || ""),
        notifyBoth:
          raw.notifyBoth === true ||
          raw.notifyBoth === "true" ||
          row.notify_both === true ||
          row.notify_both === "t" ||
          row.notify_both === "true" ||
          row.notify_both === 1,
        contactName: String(raw.contactName || "Reminder"),
        message: String(raw.message || ""),
        ownerTen: digits(String(raw.ownerTen || row.owner_ten)),
        contactTen: digits(String(raw.contactTen || row.contact_ten)),
      };
      if (!reminderIsDue(reminder)) continue;
      const next = { ...raw, ...reminder, lastFired: stamp };
      const claimed = await sql.query<{ id: string }>(
        `update vaani_reminders set payload = $2::jsonb, fired_stamp = $3
         where id = $1 and fired_stamp is distinct from $3
         returning id`,
        [row.id, JSON.stringify(next), stamp],
      );
      if (!claimed.length) continue;
      const ownerPhone = reminder.ownerTen;
      const contactPhone = reminder.contactTen;
      const body = reminder.message || reminder.contactName || "Reminder";
      const ownerTitle = reminder.contactName || "Reminder";
      let contactTitle = "";
      try {
        const saved = await sql.query<{ names: Record<string, string> | string }>(
          `select names from vaani_phonebook where phone = $1 limit 1`,
          [contactPhone],
        );
        const rawNames = saved[0]?.names;
        const names = typeof rawNames === "string" ? (JSON.parse(rawNames) as Record<string, string>) : rawNames || {};
        contactTitle = String(names[ownerPhone] || names[digits(ownerPhone)] || "").trim();
      } catch {
        contactTitle = "";
      }
      if (!contactTitle) {
        const bookHit = String(book[ownerPhone] || book[digits(ownerPhone)] || "").trim();
        if (ten === contactPhone && bookHit) contactTitle = bookHit;
      }
      if (!contactTitle) {
        try {
          const shops = await sql.query<{ shop_name: string }>(
            `select shop_name from vaani_profiles where phone = $1 or right(regexp_replace(coalesce(phone,''), '[^0-9]', '', 'g'), 10) = $1 limit 1`,
            [ownerPhone],
          );
          const shop = (Array.isArray(shops) ? shops : []).find((s) => (s.shop_name || "").trim());
          if (shop?.shop_name?.trim()) contactTitle = shop.shop_name.trim();
        } catch {
          /* keep empty */
        }
      }
      if (!contactTitle) contactTitle = "Reminder";
      const phones = reminder.notifyBoth
        ? [ownerPhone, contactPhone].filter((p) => p.length === 10)
        : [ownerPhone].filter((p) => p.length === 10);
      for (const phone of phones) {
        const title = phone === ownerPhone ? ownerTitle : contactTitle;
        const nid = `due-${row.id}-${phone}-${stamp}`;
        try {
          await sql.query(
            `insert into vaani_inbox (id, phone, title, body, ticket_id) values ($1, $2, $3, $4, $5)
             on conflict (id) do nothing`,
            [nid, phone, title, body, `reminder:${row.id}`],
          );
        } catch {
          /* inbox optional */
        }
        if (phone === ten) notices.push({ id: nid, title, body, ticketId: `reminder:${row.id}` });
      }
      try {
        await sendPushToPhones([ownerPhone].filter((p) => p.length === 10), ownerTitle, body, "/");
      } catch {
        /* owner push optional */
      }
      if (reminder.notifyBoth && contactPhone.length === 10) {
        try {
          await sendPushToPhones([contactPhone], contactTitle, body, "/");
        } catch {
          /* contact push optional */
        }
      }
      fired += 1;
    }
    {
      const extra = await sql.query<{ id: string; title: string; body: string; ticket_id: string }>(
        `select id, title, body, ticket_id from vaani_inbox where phone = $1 and created_at > now() - interval '20 minutes' order by created_at desc limit 20`,
        [ten],
      );
      for (const row of extra) {
        notices.push({
          id: row.id,
          title: row.title,
          body: row.body,
          ticketId: row.ticket_id || `reminder:${row.id}`,
        });
      }
    }
    return { fired, notices };
  });

export const fireReminderPush = createServerFn({ method: "POST" })
  .middleware([vaaniGate])
  .validator((input: { phones: string[]; title: string; body: string }) => input)
  .handler(async ({ data }) => {
    const { sendPushToPhones } = await import("./push-server");
    const phones = data.phones.map((p) => digits(p)).filter((p) => p.length === 10);
    await sendPushToPhones(phones, data.title, data.body, "/");
    return { ok: true as const };
  });
