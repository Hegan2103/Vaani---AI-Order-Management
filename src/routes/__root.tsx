import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { AppShell } from "@/components/app-shell";
import { LoginGate } from "@/components/login-screen";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import appCss from "../styles.css?url";

const APP_NAME = "Vaani";
const CRED_SCRIPT = `(function(){try{if(sessionStorage.getItem("vaani-signed-out")==="1"){var b=document.getElementById("vaani-cred-bar");if(b){b.textContent="";b.style.display="none"}document.documentElement.removeAttribute("data-vaani-phone");document.documentElement.removeAttribute("data-vaani-shop");return}var q="";try{q=new URLSearchParams(location.search).get("v")||""}catch(e){}var c="";try{c=(document.cookie.match(/(?:^|; )vaani_phone=(\\d{10})/)||[])[1]||""}catch(e){}var ls="";try{ls=localStorage.getItem("vaani-login-phone")||sessionStorage.getItem("vaani-login-phone")||""}catch(e){}var d=String(q||c||ls).replace(/\\D/g,"").slice(-10);if(d.length!==10){var el0=document.getElementById("vaani-cred-bar");if(el0){el0.textContent="";el0.style.display="none"}return}var shop="";try{var m=document.cookie.match(/(?:^|; )vaani_shop=([^;]*)/);if(m&&m[1])shop=decodeURIComponent(m[1])}catch(e){}try{var raw=localStorage.getItem("vaani-shop-identity-v1:"+d)||localStorage.getItem("vaani-shop-identity-v1")||"";if(raw){var p=JSON.parse(raw);if(p&&p.shopName)shop=String(p.shopName)}}catch(e){}var t="+91 "+d.slice(0,5)+" "+d.slice(5);var el=document.getElementById("vaani-cred-bar");if(el){el.textContent=shop?shop+" · "+t:t;el.style.display="block"}document.documentElement.setAttribute("data-vaani-phone",d);if(shop)document.documentElement.setAttribute("data-vaani-shop",shop)}catch(e){}})();`;

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