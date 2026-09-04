import { Component, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { storeBearerToken, signInGoogle } from "@/lib/auth/client";
import {
  liveLoginTen,
  loginPhoneKey,
  readLoginTen,
  readUiLanguage,
  rememberLoginTen,
  restoreLocalAccount,
  useVaani,
  writeUiLanguage,
} from "@/lib/vaani/store";
import { LANGUAGES } from "@/lib/vaani/seed";
import { isRtl, t as tr, useT } from "@/lib/vaani/i18n";

const ENTERED_KEY = "vaani-entered";
const TYPING_KEY = "vaani-typing-phone";
let stickyEntered = false;
let signedOutLock = false;
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

export function isSignedOut() {
  if (signedOutLock) return true;
  try {
    return sessionStorage.getItem("vaani-signed-out") === "1";
  } catch {
    return false;
  }
}

function markEntered() {
  stickyEntered = true;
  signedOutLock = false;
  try {
    sessionStorage.removeItem("vaani-signed-out");
  } catch {
    /* ignore */
  }
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

export function keepSession() {
  if (isSignedOut()) return;
  if (readLoginTen().length === 10) markEntered();
}
export function setOtpLock(_on: boolean) {}
export function markSessionOk(on: boolean) {
  if (on) markEntered();
  else resetLoginGate();
}

export function resetLoginGate() {
  stickyEntered = false;
  signedOutLock = true;
  typed = "";
  try {
    const phoneKey = loginPhoneKey();
    localStorage.removeItem(ENTERED_KEY);
    sessionStorage.removeItem(ENTERED_KEY);
    localStorage.removeItem("vaani-store-v3");
    sessionStorage.removeItem("vaani-store-v3");
    localStorage.removeItem("vaani-restored");
    localStorage.removeItem(phoneKey);
    sessionStorage.removeItem(phoneKey);
    localStorage.removeItem(TYPING_KEY);
    sessionStorage.removeItem(TYPING_KEY);
    localStorage.removeItem("vaani-shop-locked");
    sessionStorage.removeItem("vaani-shop-locked");
    localStorage.removeItem("vaani-shop-identity-v1");
    sessionStorage.removeItem("vaani-shop-identity-v1");
    sessionStorage.setItem("vaani-signed-out", "1");
  } catch {
    /* ignore */
  }
  try {
    useVaani.setState({
      customerName: "",
      customerPhone: "",
      industry: "",
      isVendor: false,
      shopSaved: false,
      tickets: [],
      incoming: [],
    });
  } catch {
    /* ignore */
  }
  try {
    document.cookie = `${ENTERED_KEY}=; path=/; max-age=0`;
    document.cookie = "vaani_phone=; path=/; max-age=0";
  } catch {
    /* ignore */
  }
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("v");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    /* ignore */
  }
  try {
    const bar = document.getElementById("vaani-cred-bar");
    if (bar) {
      bar.textContent = "";
      bar.style.display = "none";
    }
    document.documentElement.removeAttribute("data-vaani-phone");
    document.documentElement.removeAttribute("data-vaani-shop");
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
          <p className="font-medium">{tr(useVaani.getState().language || "en-IN", "shopViewError")}</p>
          <p className="mt-2 text-sm text-danger">{this.state.message}</p>
        </main>
      );
    }
    return this.props.children;
  }
}

function hasActiveSession() {
  if (isSignedOut()) return false;
  if (stickyEntered) return true;
  try {
    return sessionStorage.getItem(ENTERED_KEY) === "1" || localStorage.getItem(ENTERED_KEY) === "1";
  } catch {
    return false;
  }
}

export function LoginGate({ children, startOn }: { children: ReactNode; startOn?: boolean }) {
  const [on, setOn] = useState(() => {
    if (typeof window !== "undefined" && isSignedOut()) return false;
    return Boolean(startOn);
  });

  useLayoutEffect(() => {
    const lang = useVaani.getState().language || readUiLanguage();
    if (lang) {
      document.documentElement.lang = lang;
      document.documentElement.dir = isRtl(lang) ? "rtl" : "ltr";
      if (useVaani.getState().language !== lang) useVaani.getState().setLanguage(lang);
    }
    const ten = hasActiveSession() ? liveLoginTen() || readLoginTen() : "";
    try {
      if (ten.length === 10) restoreLocalAccount(ten);
    } catch {
      /* ignore */
    }
    if (isSignedOut()) {
      setOn(false);
      const bar = document.getElementById("vaani-cred-bar");
      if (bar) bar.style.display = "none";
      return;
    }
    if (hasActiveSession() && ten.length === 10) {
      stickyEntered = true;
      setOn(true);
    }
    const sync = (ev?: Event) => {
      if (isSignedOut()) {
        setOn(false);
        return;
      }
      if (ev?.type === "vaani-auth" && hasActiveSession() && (liveLoginTen() || readLoginTen()).length === 10) {
        setOn(true);
      }
    };
    window.addEventListener("vaani-auth", sync);
    return () => {
      window.removeEventListener("vaani-auth", sync);
    };
  }, [startOn]);

  if (!on) {
    return (
      <LoginScreen
        onEntered={() => {
          markEntered();
          restoreLocalAccount(readLoginTen());
          setOn(true);
        }}
      />
    );
  }
  return <ShellGuard>{children}</ShellGuard>;
}

export function LoginScreen({ onEntered }: { onEntered?: () => void }) {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [previewCode, setPreviewCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const otpRef = useRef<HTMLInputElement>(null);
  const language = useVaani((s) => s.language);
  const setLanguage = useVaani((s) => s.setLanguage);
  const { t } = useT();

  useLayoutEffect(() => {
    const bar = document.getElementById("vaani-cred-bar");
    if (bar) {
      bar.textContent = "";
      bar.style.display = "none";
    }
    document.documentElement.removeAttribute("data-vaani-phone");
    document.documentElement.removeAttribute("data-vaani-shop");
  }, []);

  function livePhone() {
    return toTen(phoneRef.current?.value || phone);
  }

  function liveOtp() {
    return String(otpRef.current?.value || otp).replace(/\D/g, "").slice(0, 6);
  }

  function setDigits(next: string) {
    const ten = toTen(next);
    persistTyping(ten);
    setPhone(ten);
    setErr(null);
    const node = document.getElementById("vaani-phone-count");
    if (node) node.textContent = `${ten.length}/10`;
  }

  function wakePhoneBox() {
    const el = phoneRef.current;
    if (!el || el.dataset.awake === "1") return;
    el.dataset.awake = "1";
    const cur = el.value;
    el.value = `${cur}0`;
    el.value = cur;
    setDigits(el.value);
  }

  useLayoutEffect(() => {
    if (step !== "phone") return;
    const el = phoneRef.current;
    if (!el) return;
    const pull = () => {
      const box = toTen(el.value);
      if (box.length) setDigits(box);
    };
    const addFromKey = (e: Event) => {
      const ke = e as KeyboardEvent;
      if (ke.key === "Backspace" || ke.key === "Delete") {
        const box = toTen(el.value);
        setDigits(box.length ? box : typed.slice(0, -1));
        return;
      }
      let d = "";
      if (ke.key >= "0" && ke.key <= "9") d = ke.key;
      else if (/^Digit[0-9]$/.test(ke.code)) d = ke.code.slice(5);
      else if (ke.keyCode >= 48 && ke.keyCode <= 57) d = String(ke.keyCode - 48);
      if (!d) return;
      const box = toTen(el.value);
      setDigits(box.length > typed.length ? box : typed + d);
    };
    const onBefore = (e: Event) => {
      const ie = e as InputEvent;
      if (ie.inputType?.startsWith("delete")) {
        setDigits(toTen(el.value) || typed.slice(0, -1));
        return;
      }
      const data = ie.data;
      if (!data || !/\d/.test(data)) return;
      const box = toTen(el.value);
      setDigits(box.length ? box : typed + data);
    };
    pull();
    el.addEventListener("input", pull);
    el.addEventListener("keyup", pull);
    el.addEventListener("keydown", addFromKey);
    el.addEventListener("change", pull);
    el.addEventListener("paste", pull);
    el.addEventListener("beforeinput", onBefore);
    const id = window.setInterval(pull, 50);
    return () => {
      window.clearInterval(id);
      el.removeEventListener("input", pull);
      el.removeEventListener("keyup", pull);
      el.removeEventListener("keydown", addFromKey);
      el.removeEventListener("change", pull);
      el.removeEventListener("paste", pull);
      el.removeEventListener("beforeinput", onBefore);
    };
  }, [step]);

  useEffect(() => {
    if (step !== "otp") return;
    const el = otpRef.current;
    if (!el) return;
    const sync = () => {
      const code = el.value.replace(/\D/g, "").slice(0, 6);
      setOtp(code);
      setErr(null);
    };
    el.addEventListener("input", sync);
    el.addEventListener("keyup", sync);
    el.addEventListener("change", sync);
    return () => {
      el.removeEventListener("input", sync);
      el.removeEventListener("keyup", sync);
      el.removeEventListener("change", sync);
    };
  }, [step]);

  function requestCode() {
    const ten = livePhone();
    if (ten.length !== 10) {
      setErr(t("tapTen"));
      return;
    }
    const code = String(100000 + Math.floor(Math.random() * 900000));
    try {
      sessionStorage.setItem("vaani-otp-code", `${ten}:${code}`);
    } catch {
      /* ignore */
    }
    setPhone(ten);
    setOtp("");
    setPreviewCode(code);
    setStep("otp");
    setErr(null);
  }

  function finish(ten: string) {
    rememberLoginTen(ten);
    stickyEntered = true;
    const formatted = `+91 ${ten.slice(0, 5)} ${ten.slice(5)}`;
    const prev = String(useVaani.getState().customerPhone || "").replace(/\D/g, "").slice(-10);
    if (prev !== ten) {
      useVaani.setState({
        customerPhone: formatted,
        customerName: "",
        industry: "",
        isVendor: false,
        shopSaved: false,
      });
    } else {
      useVaani.setState({ customerPhone: formatted });
    }
    restoreLocalAccount(ten);
    useVaani.getState().setAccountReady(true);
    markEntered();
    onEntered?.();
  }

  function checkCode() {
    const ten = livePhone() || toTen(phone);
    const code = liveOtp();
    if (ten.length !== 10) {
      setErr(t("tapTen"));
      setStep("phone");
      return;
    }
    if (code.length !== 6) {
      setErr(t("otpCount", { n: code.length }));
      return;
    }
    let expected = previewCode;
    try {
      const saved = sessionStorage.getItem("vaani-otp-code") || "";
      if (saved.startsWith(`${ten}:`)) expected = saved.slice(ten.length + 1);
    } catch {
      /* ignore */
    }
    if (code !== expected) {
      setErr(t("wrongCode"));
      return;
    }
    finish(ten);
  }

  return (
    <main className="min-h-dvh bg-bg text-ink">
      <div className="mx-auto max-w-md px-4 pb-10 pt-8">
        <div className="w-full rounded-[var(--radius-xl)] border border-line bg-surface p-6">
          <div className="mb-4 flex justify-end">
            <select
              aria-label={t("language")}
              value={language || "en-IN"}
              onChange={(e) => {
                const next = e.target.value;
                setLanguage(next);
                writeUiLanguage(next);
                document.documentElement.lang = next;
                document.documentElement.dir = next.startsWith("ur") ? "rtl" : "ltr";
              }}
              className="relative z-20 h-11 min-w-[8rem] rounded-[var(--radius-sm)] border border-line bg-bg px-2 text-sm"
            >
              {LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <p className="font-display text-3xl tracking-tight">Vaani</p>
          <h1 className="mt-1 text-lg font-medium">{t("signIn")}</h1>

          {step === "phone" ? (
            <>
              <p className="mt-3 text-sm text-muted">{t("enterMobile")}</p>
              <p className="mt-5 text-xs text-muted">{t("mobile")}</p>
              <div className="mt-1 flex items-center gap-2 rounded-[var(--radius-md)] border border-line bg-white px-3 py-3">
                <span className="text-sm text-muted">+91</span>
                <input
                  ref={phoneRef}
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  name="mobile"
                  maxLength={10}
                  defaultValue=""
                  placeholder="9876543210"
                  onTouchStart={wakePhoneBox}
                  onFocus={wakePhoneBox}
                  onInput={(e) => setDigits((e.target as HTMLInputElement).value)}
                  onChange={(e) => setDigits(e.target.value)}
                  onKeyUp={(e) => setDigits((e.target as HTMLInputElement).value)}
                  className="min-h-11 min-w-0 flex-1 bg-transparent text-lg font-medium tracking-[0.12em] text-ink outline-none"
                />
              </div>
              <p id="vaani-phone-count" className={`mt-2 text-sm ${phone.length === 10 ? "font-medium text-ink" : "text-muted"}`}>
                {phone.length}/10
              </p>
              <button
                type="button"
                className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-[var(--radius-md)] bg-accent text-base font-medium text-accent-fg"
                onClick={() => {
                  const ten = livePhone();
                  if (ten.length === 10) requestCode();
                  else setErr(t("tapTen"));
                }}
              >
                {t("sendCode")}
              </button>
              <p className="mt-5 text-center text-sm font-medium tracking-wide text-muted">OR</p>
              <button
                type="button"
                className="mt-2 inline-flex h-12 w-full items-center justify-center rounded-[var(--radius-md)] border border-line bg-surface text-base font-medium"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  setErr(null);
                  void signInGoogle("/").catch((e) => {
                    setErr(e instanceof Error ? e.message : t("signIn"));
                    setBusy(false);
                  });
                }}
              >
                {busy ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    {t("pleaseWait")}
                  </span>
                ) : (
                  t("continueWith", { name: "Google" })
                )}
              </button>
            </>
          ) : (
            <>
              <p className="mt-3 text-sm text-muted">
                {t("enterOtp", { phone: `+91 ${phone.slice(0, 5)} ${phone.slice(5)}` })}
              </p>
              {previewCode ? (
                <p className="mt-3 rounded-[var(--radius-md)] bg-accent-soft px-3 py-2 text-sm font-medium">
                  {t("previewCode", { code: previewCode })}
                </p>
              ) : null}
              <p className="mt-5 text-xs text-muted">{t("otpLabel")}</p>
              <input
                ref={otpRef}
                type="tel"
                inputMode="numeric"
                autoComplete="one-time-code"
                name="otp"
                maxLength={6}
                defaultValue=""
                placeholder="______"
                className="mt-1 h-12 w-full rounded-[var(--radius-md)] border border-line bg-white px-3 text-center text-xl font-medium tracking-[0.4em] outline-none"
              />
              <p className={`mt-2 text-sm ${otp.length === 6 ? "font-medium text-ink" : "text-muted"}`}>
                {otp.length === 6 ? t("otpReady", { n: otp.length }) : t("otpCount", { n: otp.length })}
              </p>
              <button
                type="button"
                className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-[var(--radius-md)] bg-accent text-base font-medium text-accent-fg"
                onClick={checkCode}
              >
                {t("verifySignIn")}
              </button>
              <div className="mt-3 flex gap-2">
                <Button type="button" variant="outline" className="flex-1" disabled={busy} onClick={() => void requestCode()}>
                  {t("resendCode")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  disabled={busy}
                  onClick={() => {
                    setStep("phone");
                    setOtp("");
                    setPreviewCode("");
                    setErr(null);
                  }}
                >
                  {t("changeNumber")}
                </Button>
              </div>
            </>
          )}
          {err ? <p className="mt-3 text-sm text-danger">{err}</p> : null}
        </div>
      </div>
    </main>
  );
}
