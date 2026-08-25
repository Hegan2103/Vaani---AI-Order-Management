import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { AppShell } from "@/components/app-shell";
import { LoginGate } from "@/components/login-screen";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import appCss from "../styles.css?url";

const APP_NAME = "Vaani";
const CRED_SCRIPT = `(function(){try{var q="";try{q=new URLSearchParams(location.search).get("v")||""}catch(e){}var c="";try{c=(document.cookie.match(/(?:^|; )vaani_phone=(\\d{10})/)||[])[1]||""}catch(e){}var ls="";try{ls=localStorage.getItem("vaani-login-phone")||sessionStorage.getItem("vaani-login-phone")||""}catch(e){}var d=String(q||c||ls).replace(/\\D/g,"").slice(-10);var shop="";try{var raw=localStorage.getItem("vaani-shop-identity-v1")||sessionStorage.getItem("vaani-shop-identity-v1")||"";if(!raw&&d)raw=localStorage.getItem("vaani-shop-identity-v1:"+d)||"";if(raw){var p=JSON.parse(raw);if(p&&p.shopName)shop=String(p.shopName);if(!d&&p&&p.phone)d=String(p.phone).replace(/\\D/g,"").slice(-10)}}catch(e){}if(d.length!==10)return;var t="+91 "+d.slice(0,5)+" "+d.slice(5);var el=document.getElementById("vaani-cred-bar");if(el){el.textContent=shop?shop+" · "+t:t;el.style.display="block"}document.documentElement.setAttribute("data-vaani-phone",d)}catch(e){}})();`;

export const Route = createRootRoute({
  beforeLoad: async ({ location }) => {
    try {
      const s = location.search as unknown;
      let v = "";
      if (typeof s === "string") {
        v = new URLSearchParams(s.replace(/^\?/, "")).get("v") || "";
      } else if (s && typeof s === "object") {
        const val = (s as { v?: unknown }).v;
        if (typeof val === "string" || typeof val === "number") v = String(val);
      }
      const ten = v.replace(/\D/g, "").slice(-10);
      if (ten.length === 10) return { entered: true as const, phone: ten };
      if (typeof window === "undefined") {
        const { readVaaniCookieTen } = await import("@/lib/vaani/entered.server");
        const cookieTen = readVaaniCookieTen();
        return { entered: cookieTen.length === 10, phone: cookieTen };
      }
    } catch {
      /* ignore */
    }
    return { entered: false as const };
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      { name: "theme-color", content: "#2A5D55" },
      {
        name: "description",
        content: "Voice orders between shops and vendors — no weekly call.",
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600&family=Fraunces:opsz,wght@9..144,500;9..144,600&display=swap",
      },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  const ctx = Route.useRouteContext() as { entered?: boolean; phone?: string };
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <div
          id="vaani-cred-bar"
          suppressHydrationWarning
          className="border-b border-line bg-bg px-4 py-2 text-center text-sm font-medium text-ink"
          style={{ display: "none" }}
        />
        <script dangerouslySetInnerHTML={{ __html: CRED_SCRIPT }} />
        <PreviewHostBridge />
        <AuthProvider>
          <LoginGate startOn={Boolean(ctx?.entered)}>
            <AppShell seedPhone={ctx?.phone}>
              <Outlet />
            </AppShell>
          </LoginGate>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}