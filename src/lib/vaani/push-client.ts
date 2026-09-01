import { savePushSubscription } from "./account";
import { VAPID_PUBLIC } from "./vapid";
import { phoneDigits } from "./seed";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export async function showLocalPopup(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  try {
    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }
    if (Notification.permission !== "granted") return;
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      await reg.showNotification(title, {
        body,
        icon: "/favicon.svg",
        badge: "/favicon.svg",
        tag: `vaani-${Date.now()}`,
        renotify: true,
      });
      return;
    }
    const n = new Notification(title, { body, icon: "/favicon.svg" });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* blocked */
  }
}

export async function enablePush(phone: string) {
  if (typeof window === "undefined") return;
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
  const ten = phoneDigits(phone);
  if (ten.length !== 10) return;
  try {
    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }
    if (Notification.permission !== "granted") return;
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    });
    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;
    await savePushSubscription({
      data: {
        phone: ten,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      },
    });
  } catch {
    /* http / blocked / no push */
  }
}
