import { r as createServerFn } from "./ssr.mjs";
import { r as getSql } from "./db-Lm8AQrOL.mjs";
import { t as createServerRpc } from "./createServerRpc-CcvdN_gc.mjs";
import { t as authMiddleware } from "./middleware-HWUekL9b.mjs";
import { c as phoneDigits, o as demoIncomingForIndustry, s as inboxIdForUser } from "./seed-CNZW8z6S.mjs";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
//#region node_modules/.nitro/vite/services/ssr/assets/account-bm67ZWGe.js
function digits(phone) {
	const d = phone.replace(/\D/g, "");
	if (d.length === 12 && d.startsWith("91")) return d.slice(2);
	if (d.length === 11 && d.startsWith("0")) return d.slice(1);
	return d;
}
function hashCode(phone, code) {
	return createHash("sha256").update(`${phone}:${code}`).digest("hex");
}
function phoneEmail(ten) {
	return `91${ten}@phone.vaani.app`;
}
async function ensureVaaniSchema(sql) {
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
	await sql.query(`alter table vaani_profiles add column if not exists language text not null default 'hi-IN'`);
}
function stablePassword(ten) {
	const pepper = process.env.XAI_API_KEY || "vaani-preview-pepper";
	return `Va-${createHash("sha256").update(`vaani-pw:${ten}:${pepper}`).digest("hex").slice(0, 24)}!aA1`;
}
var requestWhatsappOtp_createServerFn_handler = createServerRpc({
	id: "d867dfe388acac63aae92cc37b21f0dcac958f23e66fb147b5f5509514be742f",
	name: "requestWhatsappOtp",
	filename: "src/lib/vaani/account.ts"
}, (opts) => requestWhatsappOtp.__executeServer(opts));
var requestWhatsappOtp = createServerFn({ method: "POST" }).validator((input) => input).handler(requestWhatsappOtp_createServerFn_handler, async ({ data }) => {
	const ten = digits(data.phone);
	if (ten.length !== 10) return {
		ok: false,
		error: "Enter a 10-digit Indian mobile number."
	};
	const code = String(1e5 + randomBytes(3).readUIntBE(0, 3) % 9e5);
	await (await getSql())`
      insert into vaani_otp (phone, code_hash, expires_at, attempts)
      values (${ten}, ${hashCode(ten, code)}, now() + interval '5 minutes', 0)
      on conflict (phone) do update set code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0
    `;
	return {
		ok: true,
		waUrl: `https://wa.me/91${ten}?text=${encodeURIComponent(`Vaani login code: ${code}\nValid 5 minutes. Do not share.`)}`,
		previewCode: code
	};
});
var verifyWhatsappOtp_createServerFn_handler = createServerRpc({
	id: "75f3c2897820bb7184178899f2501c348f04f7be823106957078a1cc2e253932",
	name: "verifyWhatsappOtp",
	filename: "src/lib/vaani/account.ts"
}, (opts) => verifyWhatsappOtp.__executeServer(opts));
var verifyWhatsappOtp = createServerFn({ method: "POST" }).validator((input) => input).handler(verifyWhatsappOtp_createServerFn_handler, async ({ data }) => {
	const ten = digits(data.phone);
	const code = data.code.replace(/\D/g, "");
	if (ten.length !== 10 || code.length !== 6) return {
		ok: false,
		error: "Check the number and 6-digit code."
	};
	const sql = await getSql();
	const row = (await sql`
      select code_hash, expires_at::text, attempts from vaani_otp where phone = ${ten}
    `)[0];
	if (!row) return {
		ok: false,
		error: "Request a code first."
	};
	if (Number(row.attempts) >= 5) return {
		ok: false,
		error: "Too many tries. Request a new code."
	};
	if (new Date(row.expires_at).getTime() < Date.now()) return {
		ok: false,
		error: "Code expired. Request a new one."
	};
	const expected = Buffer.from(row.code_hash);
	const got = Buffer.from(hashCode(ten, code));
	if (expected.length !== got.length || !timingSafeEqual(expected, got)) {
		await sql`update vaani_otp set attempts = attempts + 1 where phone = ${ten}`;
		return {
			ok: false,
			error: "That code does not match."
		};
	}
	await sql`delete from vaani_otp where phone = ${ten}`;
	return {
		ok: true,
		email: phoneEmail(ten),
		password: stablePassword(ten),
		phone: `+91 ${ten.slice(0, 5)} ${ten.slice(5)}`
	};
});
var loadProfile_createServerFn_handler = createServerRpc({
	id: "bbd71c36d0677d3058624dd01c82d1976c9ea9fa2ce9fd70265fe71a258cd4ad",
	name: "loadProfile",
	filename: "src/lib/vaani/account.ts"
}, (opts) => loadProfile.__executeServer(opts));
var loadProfile = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(loadProfile_createServerFn_handler, async ({ context }) => {
	const sql = await getSql();
	await ensureVaaniSchema(sql);
	const row = (await sql`
      select shop_name, phone, role, vendor_id, industry, is_vendor, language
      from vaani_profiles where user_id = ${context.userId}
    `)[0];
	if (!row) return null;
	return {
		...row,
		is_vendor: row.is_vendor === true || row.is_vendor === "t" || row.is_vendor === "true" || row.is_vendor === 1,
		language: row.language || "hi-IN"
	};
});
var saveProfile_createServerFn_handler = createServerRpc({
	id: "4a60c2ccfa5a6273b24e0859a368c801034b7ee2c71cbd141cda607e6fb1c501",
	name: "saveProfile",
	filename: "src/lib/vaani/account.ts"
}, (opts) => saveProfile.__executeServer(opts));
var saveProfile = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(saveProfile_createServerFn_handler, async ({ context, data }) => {
	const shopName = data.shopName.trim();
	if (!shopName) return {
		ok: false,
		error: "Shop name cannot be empty."
	};
	const sql = await getSql();
	await ensureVaaniSchema(sql);
	const existing = await sql`
      select phone from vaani_profiles where user_id = ${context.userId}
    `;
	const phone = data.phone.trim() || existing[0]?.phone || "";
	const vendorId = data.isVendor ? inboxIdForUser(context.userId) : data.vendorId ?? "";
	const industry = data.industry ?? "";
	const flag = data.isVendor ? "true" : "false";
	const language = data.language || "hi-IN";
	try {
		await sql.query(`insert into vaani_profiles (user_id, shop_name, phone, role, vendor_id, industry, is_vendor, language)
         values ($1, $2, $3, $4, $5, $6, $7::boolean, $8)
         on conflict (user_id) do update set
           shop_name = excluded.shop_name,
           phone = excluded.phone,
           role = excluded.role,
           industry = excluded.industry,
           is_vendor = excluded.is_vendor,
           vendor_id = excluded.vendor_id,
           language = excluded.language`, [
			context.userId,
			shopName,
			phone,
			data.role,
			vendorId,
			industry,
			flag,
			language
		]);
		return {
			ok: true,
			vendorId
		};
	} catch (err) {
		return {
			ok: false,
			error: err instanceof Error ? err.message : "Could not save shop details."
		};
	}
});
var saveLanguage_createServerFn_handler = createServerRpc({
	id: "5c31e13fa707c786ea03c2b64509d945590e8dfa16533841309719c4191c0c12",
	name: "saveLanguage",
	filename: "src/lib/vaani/account.ts"
}, (opts) => saveLanguage.__executeServer(opts));
var saveLanguage = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(saveLanguage_createServerFn_handler, async ({ context, data }) => {
	const language = data.language.trim() || "hi-IN";
	const sql = await getSql();
	await ensureVaaniSchema(sql);
	await sql.query(`insert into vaani_profiles (user_id, shop_name, phone, role, vendor_id, industry, is_vendor, language)
       values ($1, '', '', 'customer', '', '', false, $2)
       on conflict (user_id) do update set language = excluded.language`, [context.userId, language]);
	return { ok: true };
});
var rememberLoginPhone_createServerFn_handler = createServerRpc({
	id: "8657fc208979db5be8c895a526039b5c6a194a34d67915473e65b08cc534277c",
	name: "rememberLoginPhone",
	filename: "src/lib/vaani/account.ts"
}, (opts) => rememberLoginPhone.__executeServer(opts));
var rememberLoginPhone = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(rememberLoginPhone_createServerFn_handler, async ({ context, data }) => {
	const ten = phoneDigits(data.phone);
	if (ten.length !== 10) return { ok: false };
	const formatted = `+91 ${ten.slice(0, 5)} ${ten.slice(5)}`;
	const sql = await getSql();
	await ensureVaaniSchema(sql);
	await sql.query(`insert into vaani_profiles (user_id, shop_name, phone, role, vendor_id, industry, is_vendor)
       values ($1, '', $2, 'customer', '', '', false)
       on conflict (user_id) do update set
         phone = case when vaani_profiles.phone = '' then excluded.phone else vaani_profiles.phone end`, [context.userId, formatted]);
	return {
		ok: true,
		phone: formatted
	};
});
var listRegisteredVendors_createServerFn_handler = createServerRpc({
	id: "d8690190df125a72450ce6419fdf48ea2ec9d1945243cef6194a42ad1de7968e",
	name: "listRegisteredVendors",
	filename: "src/lib/vaani/account.ts"
}, (opts) => listRegisteredVendors.__executeServer(opts));
var listRegisteredVendors = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(listRegisteredVendors_createServerFn_handler, async () => {
	const sql = await getSql();
	await ensureVaaniSchema(sql);
	const rows = await sql.query(`select p.user_id, p.shop_name, p.phone, p.industry, p.is_vendor, p.vendor_id, u.email
       from vaani_profiles p
       left join "user" u on u.id = p.user_id`);
	const trades = [
		"pharmaceutical",
		"grocery",
		"electrical",
		"hardware",
		"construction",
		"electronics"
	];
	const out = [];
	for (const r of rows) {
		const emailTen = (r.email ?? "").match(/^91(\d{10})@/i)?.[1] ?? "";
		const ten = phoneDigits(r.phone) || emailTen;
		if (ten.length !== 10) continue;
		if (!(r.is_vendor === true || r.is_vendor === "t" || r.is_vendor === "true" || r.is_vendor === 1 || Boolean(r.shop_name?.trim()) || Boolean(r.vendor_id)) && !emailTen) continue;
		const industry = trades.includes(r.industry) ? r.industry : "grocery";
		const id = r.vendor_id || inboxIdForUser(r.user_id);
		const display = r.shop_name.trim() || `Shop ${ten}`;
		out.push({
			id,
			name: display,
			shop: display,
			phone: r.phone || `+91 ${ten.slice(0, 5)} ${ten.slice(5)}`,
			city: "",
			industry,
			catalog: [],
			altPhones: [
				`+91${ten}`,
				`91${ten}`,
				ten,
				`+91 ${ten.slice(0, 5)} ${ten.slice(5)}`
			]
		});
	}
	const users = await sql.query(`select id, email, name from "user"`);
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
			altPhones: [
				`+91${ten}`,
				`91${ten}`,
				ten
			]
		});
	}
	return out;
});
var claimVendorShop_createServerFn_handler = createServerRpc({
	id: "e26edb810a555062b32b50707539e0147c6d3458ef579e4000a1090a438f699e",
	name: "claimVendorShop",
	filename: "src/lib/vaani/account.ts"
}, (opts) => claimVendorShop.__executeServer(opts));
var claimVendorShop = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(claimVendorShop_createServerFn_handler, async ({ context, data }) => {
	const vendorId = data.vendorId.trim();
	if (!vendorId) return {
		ok: false,
		error: "Pick the shop you run."
	};
	await (await getSql())`
      insert into vaani_profiles (user_id, shop_name, phone, role, vendor_id)
      values (${context.userId}, '', '', 'vendor', ${vendorId})
      on conflict (user_id) do update set role = 'vendor', vendor_id = excluded.vendor_id
    `;
	return { ok: true };
});
var DEMO_BUYER = "vaani-other-buyer";
var openVendorInbox_createServerFn_handler = createServerRpc({
	id: "6421f68dd021104d031e1ac526242b32cb01d52ff3aeb5bc24f97e2798f2f218",
	name: "openVendorInbox",
	filename: "src/lib/vaani/account.ts"
}, (opts) => openVendorInbox.__executeServer(opts));
var openVendorInbox = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(openVendorInbox_createServerFn_handler, async ({ context, data }) => {
	const sql = await getSql();
	await ensureVaaniSchema(sql);
	const row = (await sql`
      select shop_name, phone, industry, is_vendor, vendor_id from vaani_profiles
      where user_id = ${context.userId}
    `)[0];
	const industry = data.industry || row?.industry || "";
	const inboxId = inboxIdForUser(context.userId);
	if (!industry) return {
		ok: false,
		error: "Save your shop and pick the trade you sell in.",
		vendorId: "",
		tickets: [],
		industry: "",
		shopName: row?.shop_name ?? ""
	};
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
	const demos = demoIncomingForIndustry(industry, inboxId);
	for (const t of demos) await sql.query(`insert into vaani_tickets (id, user_id, vendor_id, payload)
         values ($1, $2, $3, $4::jsonb)
         on conflict (id) do nothing`, [
		t.id,
		`${DEMO_BUYER}:${t.id}`,
		t.vendorId,
		JSON.stringify(t)
	]);
	return {
		ok: true,
		vendorId: inboxId,
		tickets: (await sql`
      select payload from vaani_tickets
      where vendor_id = ${inboxId} and user_id <> ${context.userId}
      order by created_at desc
    `).map((r) => typeof r.payload === "string" ? JSON.parse(r.payload) : r.payload),
		industry,
		shopName: row?.shop_name ?? ""
	};
});
var saveTicket_createServerFn_handler = createServerRpc({
	id: "5d97397af5e2f03ba0cf4120765df87688a4aab2db929ebc109c131b2f1a078d",
	name: "saveTicket",
	filename: "src/lib/vaani/account.ts"
}, (opts) => saveTicket.__executeServer(opts));
var saveTicket = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(saveTicket_createServerFn_handler, async ({ context, data }) => {
	const t = data.ticket;
	const sql = await getSql();
	const claimed = (await sql`
      select vendor_id from vaani_profiles where user_id = ${context.userId}
    `)[0]?.vendor_id ?? "";
	await sql.query(`insert into vaani_tickets (id, user_id, vendor_id, payload)
       values ($1, $2, $3, $4::jsonb)
       on conflict (id) do update set payload = excluded.payload
       where vaani_tickets.user_id = $2
          or ($5 <> '' and vaani_tickets.vendor_id = $5)`, [
		t.id,
		context.userId,
		t.vendorId,
		JSON.stringify(t),
		claimed
	]);
	return { ok: true };
});
var listIncomingTickets_createServerFn_handler = createServerRpc({
	id: "e4f2510797cc5419271fb8a2007698b14fdf9d7ac51054cc27953f9a7e595266",
	name: "listIncomingTickets",
	filename: "src/lib/vaani/account.ts"
}, (opts) => listIncomingTickets.__executeServer(opts));
var listIncomingTickets = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(listIncomingTickets_createServerFn_handler, async ({ context, data }) => {
	if (!data.vendorId) return [];
	return (await (await getSql())`
      select payload from vaani_tickets
      where vendor_id = ${data.vendorId} and user_id <> ${context.userId}
      order by created_at desc
    `).map((r) => typeof r.payload === "string" ? JSON.parse(r.payload) : r.payload);
});
var listTickets_createServerFn_handler = createServerRpc({
	id: "ef79c1d52cca6c0acb5d220df320bda0b5bc3607c432e42d2fa39b56394733fe",
	name: "listTickets",
	filename: "src/lib/vaani/account.ts"
}, (opts) => listTickets.__executeServer(opts));
var listTickets = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(listTickets_createServerFn_handler, async ({ context }) => {
	return (await (await getSql())`
      select payload from vaani_tickets where user_id = ${context.userId} order by created_at desc
    `).map((r) => typeof r.payload === "string" ? JSON.parse(r.payload) : r.payload);
});
var getTicket_createServerFn_handler = createServerRpc({
	id: "5c7fcfb5bdb0b9e208a3bd3ec1201465d6285b9f5107f868993d81c76568252e",
	name: "getTicket",
	filename: "src/lib/vaani/account.ts"
}, (opts) => getTicket.__executeServer(opts));
var getTicket = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(getTicket_createServerFn_handler, async ({ context, data }) => {
	const sql = await getSql();
	const claimed = (await sql`
      select vendor_id from vaani_profiles where user_id = ${context.userId}
    `)[0]?.vendor_id ?? "";
	const raw = (await sql`
      select payload from vaani_tickets
      where id = ${data.id}
        and (user_id = ${context.userId} or (${claimed} <> '' and vendor_id = ${claimed}))
    `)[0]?.payload;
	if (!raw) return null;
	return typeof raw === "string" ? JSON.parse(raw) : raw;
});
//#endregion
export { claimVendorShop_createServerFn_handler, getTicket_createServerFn_handler, listIncomingTickets_createServerFn_handler, listRegisteredVendors_createServerFn_handler, listTickets_createServerFn_handler, loadProfile_createServerFn_handler, openVendorInbox_createServerFn_handler, rememberLoginPhone_createServerFn_handler, requestWhatsappOtp_createServerFn_handler, saveLanguage_createServerFn_handler, saveProfile_createServerFn_handler, saveTicket_createServerFn_handler, verifyWhatsappOtp_createServerFn_handler };
