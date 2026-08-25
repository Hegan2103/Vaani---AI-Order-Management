import { Component, useLayoutEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { GROK_PROVIDERS, signIn, storeBearerToken } from "@/lib/auth/client";
import { loginPhoneKey, readLoginTen, rememberLoginTen, restoreLocalAccount, useVaani } from "@/lib/vaani/store";

const ENTERED_KEY = "vaani-entered";
const TYPING_KEY = "vaani-typing-phone";
let stickyEntered = false;
let typed = "";

function toTen(raw: string) {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.startsWith("91") && d.length >= 12) d = d.slice(2);
  if (d.startsWith("0") && d.length === 11) d = d.slice(1);
  return d.slice(0, 10);
}

function persistTyping(ten: string) {
  typed = ten;
  try {
    sessionStorage.setItem(TYPING_KEY, ten);
    localStorage.setItem(TYPING_KEY, ten);
  } catch {
    /* ignore */
  }
}

function loadTyping() {
  if (typed) return toTen(typed);
  try {
    return toTen(sessionStorage.getItem(TYPING_KEY) || localStorage.getItem(TYPING_KEY) || "");
  } catch {
    return "";
  }
}

function readEntered() {
  if (typeof window === "undefined") return false;
  if (stickyEntered) return true;
  return readLoginTen().length === 10;
}

function markEntered() {
  stickyEntered = true;
  try {
    localStorage.setItem(ENTERED_KEY, "1");
    sessionStorage.setItem(ENTERED_KEY, "1");
  } catch {
    /* ignore */
  }
  try {
    document.cookie = `${ENTERED_KEY}=1; path=/; max-age=2592000; SameSite=Lax`;
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event("vaani-auth"));
}

export function setOtpLock(_on: boolean) {}
export function markSessionOk(on: boolean) {
  if (on) markEntered();
  else resetLoginGate();
}

export function resetLoginGate() {
  stickyEntered = false;
  typed = "";
  try {
    const phoneKey = loginPhoneKey();
    localStorage.removeItem(ENTERED_KEY);
    sessionStorage.removeItem(ENTERED_KEY);
    localStorage.removeItem("vaani-restored");
    localStorage.removeItem(phoneKey);
    sessionStorage.removeItem(phoneKey);
    localStorage.removeItem(TYPING_KEY);
    sessionStorage.removeItem(TYPING_KEY);
  } catch {
    /* ignore */
  }
  try {
    document.cookie = `${ENTERED_KEY}=; path=/; max-age=0`;
    document.cookie = "vaani_phone=; path=/; max-age=0";
  } catch {
    /* ignore */
  }
  storeBearerToken(null);
  window.dispatchEvent(new Event("vaani-auth"));
}

class ShellGuard extends Component<{ children: ReactNode }, { message: string }> {
  state = { message: "" };
  static getDerivedStateFromError(err: Error) {
    return { message: err.message };
  }
  render() {
    if (this.state.message) {
      return (
        <main className="min-h-dvh bg-bg p-6 text-ink">
          <p className="font-medium">Could not open the shop view.</p>
          <p className="mt-2 text-sm text-danger">{this.state.message}</p>
        </main>
      );
    }
    return this.props.children;
  }
}

export function LoginGate({ children }: { children: ReactNode }) {
  const [on, setOn] = useState(false);

  useLayoutEffect(() => {
    const sync = () => setOn(readEntered());
    sync();
    window.addEventListener("vaani-auth", sync);
    return () => window.removeEventListener("vaani-auth", sync);
  }, []);

  if (!on) {
    return (
      <LoginScreen
        onEntered={() => {
          markEntered();
          setOn(true);
        }}
      />
    );
  }
  return <ShellGuard>{children}</ShellGuard>;
}

export function LoginScreen({ onEntered }: { onEntered?: () => void }) {
  const [phone, setPhone] = useState(() => loadTyping());
  const [err, setErr] = useState<string | null>(null);

  function setDigits(next: string) {
    const ten = toTen(next);
    persistTyping(ten);
    setPhone(ten);
    setErr(null);
  }

  function enter() {
    const ten = toTen(phone || loadTyping());
    if (ten.length !== 10) {
      setErr("Tap all 10 digits, then tap Sign in.");
      return;
    }
    rememberLoginTen(ten);
    restoreLocalAccount(ten);
    useVaani.getState().setAccountReady(true);
    useVaani.setState({ customerPhone: `+91 ${ten.slice(0, 5)} ${ten.slice(5)}` });
    markEntered();
    onEntered?.();
  }

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "OK"] as const;

  return (
    <main className="min-h-dvh bg-bg text-ink">
      <div className="mx-auto max-w-md px-4 pb-10 pt-8">
        <div className="w-full rounded-[var(--radius-xl)] border border-line bg-surface p-6">
          <p className="font-display text-3xl tracking-tight">Vaani</p>
          <h1 className="mt-1 text-lg font-medium">Sign in</h1>
          <p className="mt-3 text-sm text-muted">Enter your 10-digit mobile number with the pad below.</p>

          <p className="mt-5 text-xs text-muted">Mobile</p>
          <div className="mt-1 flex items-center gap-2 rounded-[var(--radius-md)] border border-line bg-white px-3 py-3">
            <span className="text-sm text-muted">+91</span>
            <p className="min-h-7 flex-1 font-medium tracking-[0.28em] text-ink">
              {phone || <span className="tracking-normal text-subtle">__________</span>}
            </p>
          </div>
          <div className="mt-2 grid grid-cols-10 gap-1">
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i} className={`h-1.5 rounded-full ${i < phone.length ? "bg-accent" : "bg-line"}`} />
            ))}
          </div>
          <p className={`mt-2 text-sm ${phone.length === 10 ? "font-medium text-ink" : "text-muted"}`}>
            {phone.length}/10 digits{phone.length === 10 ? " — ready" : ""}
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {keys.map((k) => (
              <button
                key={k}
                type="button"
                className="h-14 rounded-[var(--radius-md)] border border-line bg-bg text-lg font-medium text-ink active:bg-accent-soft"
                onClick={() => {
                  if (k === "⌫") {
                    setDigits(phone.slice(0, -1));
                    return;
                  }
                  if (k === "OK") {
                    enter();
                    return;
                  }
                  if (phone.length >= 10) return;
                  setDigits(phone + k);
                }}
              >
                {k}
              </button>
            ))}
          </div>

          <Button className="mt-4 w-full" size="lg" type="button" onClick={enter}>
            Sign in
          </Button>
          {err ? <p className="mt-3 text-sm text-danger">{err}</p> : null}

          <div className="mt-6 border-t border-line pt-4">
            <p className="mb-2 text-xs text-muted">Or continue with</p>
            <div className="space-y-2">
              {GROK_PROVIDERS.filter((p) => p.idp !== "twitter" && p.providerId !== "grok-x").map((p) => (
                <Button
                  key={p.providerId}
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => void signIn(p.providerId, { callbackURL: "/" })}
                >
                  Continue with {p.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
