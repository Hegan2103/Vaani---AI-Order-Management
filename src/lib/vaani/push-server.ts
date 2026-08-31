import { getSql } from "@/lib/db";
import { VAPID_PRIVATE, VAPID_PUBLIC, VAPID_SUBJECT } from "./vapid";

export async function sendPushToPhones(
  phones: string[],
  title: string,
  body: string,
  url = "/",
) {
  const unique = [...new Set(phones.filter((p) => p.length === 10))];
  if (!unique.length) return;
  try {
    const webpush = (await import("web-push")).default;
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    const sql = await getSql();
    const rows = await sql.query<{ endpoint: string; p256dh: string; auth: string }>(
      `select endpoint, p256dh, auth from vaani_push where phone = any($1::text[])`,
      [unique],
    );
    const payload = JSON.stringify({ title, body, url });
    await Promise.all(
      rows.map(async (row) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: row.endpoint,
              keys: { p256dh: row.p256dh, auth: row.auth },
            },
            payload,
          );
        } catch (err: unknown) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await sql.query(`delete from vaani_push where endpoint = $1`, [row.endpoint]);
          }
        }
      }),
    );
  } catch {
    /* no push on this host */
  }
}
