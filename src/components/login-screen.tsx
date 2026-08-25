import { Component, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { GROK_PROVIDERS, authEnabled, signIn, storeBearerToken } from "@/lib/auth/client";
import { signInWithMobile } from "@/lib/vaani/account";
import { rememberLoginTen, restoreLocalAccount } from "@/lib/vaani/store";

const ENTERED_KEY = "vaani-entered";
let stickyEntered = false;

function onlyDigits(value: string, max: number) {
  return value.replace(/\D/g, "").slice(0, max);
}

function readEntered() {
  if (stickyEntered) return true;
  try {
    if (localStorage.getItem(ENTERED_KEY) === "1") return true;
  } catch {
    /* ignore */
  }
  try {
    return document.cookie.split("; ").includes(`${ENTERED_KEY}=1`);
  } catch {
    return false;
  }
}

function markEntered() {
  stickyEntered = true;
  try {
    localStorage.setItem(ENTERED_KEY, "1");
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
  try {
    localStorage.removeItem(ENTERED_KEY);
    localStorage.removeItem("vaani-restored");
  } catch {
    /* ignore */
  }
  try {
    document.cookie = `${ENTERED_KEY}=; path=/; max-age=0`;
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
  const [showLogin, setShowLogin] = useState(false);

  useLayoutEffect(() => {
    const sync = () => setShowLogin(!readEntered());
    sync();
    window.addEventListener("vaani-auth", sync);
    return () => window.removeEventListener("vaani-auth", sync);
  }, []);

  return (
    <>
      <div className={showLogin ? "hidden" : "contents"}>
        <ShellGuard>{children}</ShellGuard>
      </div>
      {showLogin ? (
        <LoginScreen
          onEntered={() => {
            markEntered();
            setShowLogin(false);
          }}
        />
      ) : null}
    </>
  );
}

export function LoginScreen({ onEntered }: { onEntered?: () => void }) {
  const [digits, setDigits] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const phoneRef = useRef<HTMLInputElement>(null);

  function readPhone() {
    const ten = onlyDigits(phoneRef.current?.value ?? "", 10);
    if (phoneRef.current) phoneRef.current.value = ten;
    setDigits(ten.length);
    return ten;
  }

  async function enter() {
    const ten = readPhone();
    if (ten.length !== 10) {
      setErr("Type all 10 digits, then tap Sign in.");
      return;
    }
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setErr(null);
    try {
      const res = (await signInWithMobile({ data: { phone: ten } })) as {
        ok?: boolean;
        token?: string;
        phone?: string;
        error?: string;
      };
      const token = res?.token;
      if (!token) {
        setErr(res?.error || "Sign in did not return a session. Try again.");
        return;
      }
      storeBearerToken(token);
      rememberLoginTen(res.phone || ten);
      restoreLocalAccount(ten);
      markEntered();
      onEntered?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not sign in. Tap Sign in again.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="fixed inset-0 z-50 min-h-dvh overflow-auto bg-bg text-ink">
      <div className="mx-auto max-w-md px-4 pb-10 pt-8">
        <div className="w-full rounded-[var(--radius-xl)] border border-line bg-surface p-6">
          <p className="font-display text-3xl tracking-tight">Vaani</p>
          <h1 className="mt-1 text-lg font-medium">Sign in</h1>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted">
            <li>Type your 10-digit mobile number.</li>
            <li>
              Tap <span className="font-medium text-ink">Sign in</span>.
            </li>
          </ol>

          {!authEnabled ? (
            <p className="mt-4 text-sm text-muted">Sign-in is disabled.</p>
          ) : (
            <div className="mt-5">
              <label className="block text-xs text-muted">Mobile</label>
              <div className="mt-1 flex gap-2">
                <span className="inline-flex h-11 items-center rounded-[var(--radius-md)] border border-line bg-bg px-3 text-sm text-muted">
                  +91
                </span>
                <input
                  ref={phoneRef}
                  id="vaani-mobile"
                  type="tel"
                  name="mobile"
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={10}
                  defaultValue=""
                  placeholder="9876543210"
                  onInput={(e) => {
                    const next = onlyDigits(e.currentTarget.value, 10);
                    e.currentTarget.value = next;
                    setDigits(next.length);
                    setErr(null);
                  }}
                  onKeyUp={(e) => setDigits(onlyDigits(e.currentTarget.value, 10).length)}
                  className="h-11 min-w-0 flex-1 rounded-[var(--radius-md)] border border-line bg-white px-3 text-sm text-ink"
                />
              </div>
              <p className={`mt-1 text-xs ${digits === 10 ? "text-ink" : "text-muted"}`}>
                {digits}/10 digits{digits === 10 ? " — ready" : ""}
              </p>
              <Button className="mt-4 w-full" size="lg" disabled={busy} type="button" onClick={() => void enter()}>
                {busy ? "Signing in…" : "Sign in"}
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
          )}
        </div>
      </div>
    </main>
  );
}
