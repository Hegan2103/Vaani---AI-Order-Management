import { createMiddleware } from "@tanstack/react-start";

/**
 * Identity for Vaani server functions.
 * Phone sign-in has no Google/OTP session — never throw Unauthorized.
 * userId is vaani-<10-digit> so shop, orders, and vendor listing persist.
 */
export const vaaniGate = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getBearerToken } = await import("@/lib/auth/client");
    let phone = "";
    try {
      phone = localStorage.getItem("vaani-login-phone") || sessionStorage.getItem("vaani-login-phone") || "";
    } catch {
      /* ignore */
    }
    return next({
      sendContext: {
        bearerToken: getBearerToken() ?? undefined,
        phone,
      },
    });
  })
  .server(async ({ next, context }) => {
    try {
      const { assertSameSiteRequest } = await import("@/lib/auth/isolation.server");
      assertSameSiteRequest();
    } catch {
      /* preview iframe / contact-picker resume must still reach shop + orders */
    }
    let userId = "";
    const token = (context as { bearerToken?: string }).bearerToken;
    const rawPhone = String((context as { phone?: string }).phone || "").replace(/\D/g, "");
    const phone = rawPhone.length >= 10 ? rawPhone.slice(-10) : "";
    if (token) {
      try {
        const { requireUserId } = await import("@/lib/auth/verify.server");
        userId = await requireUserId(token);
      } catch {
        userId = "";
      }
    }
    if (!userId && phone.length === 10) userId = `vaani-${phone}`;
    return next({ context: { userId, phone } });
  });
