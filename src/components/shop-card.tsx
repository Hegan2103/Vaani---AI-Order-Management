import { Pencil } from "lucide-react";
import { useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { INDUSTRY_LABEL, formatInPhone, phoneDigits } from "@/lib/vaani/seed";
import { useT } from "@/lib/vaani/i18n";
import { saveProfile } from "@/lib/vaani/account";
import { liveLoginTen, readLoginTen, readShopIdentity, useVaani, type ShopIdentity } from "@/lib/vaani/store";
import type { Industry } from "@/lib/vaani/types";

const PIN_KEY = "vaani-shop-locked";
let LOCKED: ShopIdentity | null = null;
let EDITING = false;

function remember(p: Partial<ShopIdentity> | null | undefined, ten?: string) {
  const login = phoneDigits(ten || liveLoginTen() || readLoginTen() || p?.phone || "");
  const shopName = (p?.shopName || "").trim();
  if (!shopName || login.length !== 10) return LOCKED;
  const accountType =
    p?.accountType === "individual" || p?.accountType === "business"
      ? p.accountType
      : LOCKED?.accountType === "individual"
        ? "individual"
        : "business";
  LOCKED = {
    shopName,
    phone: formatInPhone(login),
    industry: accountType === "individual" ? "" : p?.industry || "",
    isVendor: accountType === "individual" ? false : Boolean(p?.isVendor),
    language: p?.language || "en-IN",
    accountType,
  };
  try {
    sessionStorage.setItem(`${PIN_KEY}:${login}`, JSON.stringify(LOCKED));
    localStorage.setItem(`${PIN_KEY}:${login}`, JSON.stringify(LOCKED));
  } catch {
    /* ignore */
  }
  return LOCKED;
}

function pullIdentity() {
  if (typeof window === "undefined") return null;
  const ten = liveLoginTen() || readLoginTen();
  LOCKED = null;
  if (ten.length !== 10) return null;
  try {
    const raw =
      sessionStorage.getItem(`${PIN_KEY}:${ten}`) ||
      localStorage.getItem(`${PIN_KEY}:${ten}`) ||
      "";
    if (raw) remember(JSON.parse(raw) as ShopIdentity, ten);
  } catch {
    /* ignore */
  }
  remember(readShopIdentity(ten), ten);
  const s = useVaani.getState();
  if (phoneDigits(s.customerPhone) === ten && s.customerName.trim()) {
    remember(
      {
        shopName: s.customerName,
        phone: s.customerPhone,
        industry: s.industry,
        isVendor: s.isVendor,
        language: s.language,
        accountType: s.accountType === "individual" ? "individual" : "business",
      },
      ten,
    );
  }
  return LOCKED;
}
export function ShopCard({ extra }: { extra?: ReactNode }) {
  const setShopIdentity = useVaani((s) => s.setShopIdentity);
  const { t, industry: tradeLabel } = useT();
  const [editing, setEditing] = useState(EDITING);
  const [id, setId] = useState<ShopIdentity | null>(LOCKED);
  const nameRef = useRef<HTMLInputElement>(null);
  const [shopDraft, setShopDraft] = useState(LOCKED?.shopName || "");
  const [industryDraft, setIndustryDraft] = useState<Industry | "">(LOCKED?.industry || "");
  const [sellDraft, setSellDraft] = useState(Boolean(LOCKED?.isVendor));
  const [langDraft, setLangDraft] = useState(LOCKED?.language || "en-IN");
  const [typeDraft, setTypeDraft] = useState<"business" | "individual">(LOCKED?.accountType === "individual" ? "individual" : "business");
  const [shopMsg, setShopMsg] = useState<string | null>(null);
  const loginTen = liveLoginTen() || readLoginTen() || phoneDigits(useVaani.getState().customerPhone || "");
  useLayoutEffect(() => {
    const load = () => {
      if (sessionStorage.getItem("vaani-signed-out") === "1") return;
      const next = pullIdentity();
      setId(next);
      if (!EDITING) {
        setShopDraft(next?.shopName || "");
        setIndustryDraft(next?.industry || "");
        setSellDraft(Boolean(next?.isVendor));
        setLangDraft(next?.language || "en-IN");
        setTypeDraft(next?.accountType === "individual" ? "individual" : "business");
      }
    };
    load();
    window.addEventListener("vaani-auth", load);
    window.addEventListener("vaani-shop", load);
    return () => {
      window.removeEventListener("vaani-auth", load);
      window.removeEventListener("vaani-shop", load);
    };
  }, [loginTen]);

  const shown = id || LOCKED;
  const savedName = (shown?.shopName || "").trim();
  const savedPhone = formatInPhone(shown?.phone || loginTen);
  const savedIndustry = shown?.industry || "";
  const savedVendor = Boolean(shown?.isVendor);
  const savedLang = shown?.language || "en-IN";
  const savedType = shown?.accountType === "individual" ? "individual" : "business";
  const locked = Boolean(savedName) && !editing;
  const firstFill = !savedName;

  function startEdit(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setShopDraft(savedName);
    setIndustryDraft(savedIndustry);
    setSellDraft(savedVendor);
    setLangDraft(savedLang);
    setTypeDraft(savedType);
    EDITING = true;
    setEditing(true);
    setShopMsg(null);
  }

  function stopEdit() {
    EDITING = false;
    setEditing(false);
    setShopMsg(null);
  }

  function saveShop() {
    const shopName = (nameRef.current?.value || shopDraft).trim();
    if (!shopName) {
      setShopMsg(t("enterShopName"));
      nameRef.current?.focus();
      return;
    }
    const accountType = firstFill ? typeDraft : savedType;
    const identity: ShopIdentity = {
      shopName,
      phone: loginTen.length === 10 ? formatInPhone(loginTen) : savedPhone,
      industry: accountType === "individual" ? "" : industryDraft,
      isVendor: accountType === "individual" ? false : sellDraft,
      language: langDraft || "en-IN",
      accountType,
    };
    remember(identity);
    setId(identity);
    EDITING = false;
    setEditing(false);
    setShopMsg(t("shopSaved"));
    window.setTimeout(() => {
      try {
        setShopIdentity(identity);
      } catch {
        /* keep local card */
      }
      window.dispatchEvent(new Event("vaani-shop"));
    }, 0);
    void saveProfile({
      data: {
        shopName,
        phone: identity.phone,
        role: identity.isVendor ? "vendor" : "customer",
        industry: identity.industry,
        isVendor: identity.isVendor,
        language: identity.language,
      },
    }).catch(() => {
      /* local shop still saved */
    });
    window.dispatchEvent(new Event("vaani-shop"));
  }

  function setSellNow(on: boolean) {
    setSellDraft(on);
    const shopName = (nameRef.current?.value || shopDraft || savedName).trim();
    if (!shopName || loginTen.length !== 10) return;
    const identity: ShopIdentity = {
      shopName,
      phone: formatInPhone(loginTen),
      industry: industryDraft || savedIndustry,
      isVendor: on,
      language: langDraft || savedLang || "en-IN",
      accountType: "business",
    };
    remember(identity);
    setId(identity);
    setShopIdentity(identity);
    window.dispatchEvent(new Event("vaani-shop"));
  }

  const frozenBox =
    "mt-1 h-11 w-full rounded-[var(--radius-md)] border border-line px-3 text-sm text-muted cursor-not-allowed pointer-events-none";
  const frozenStyle = { background: "#e8eaed" };
  const box = "mt-1 h-11 w-full rounded-[var(--radius-md)] border border-line bg-bg px-3 text-sm";
  const liveType = firstFill ? typeDraft : savedType;
  const nameFrozen = !firstFill;
  const typeFrozen = !firstFill;
  const extraFrozen = liveType === "individual" || !firstFill;
  const sellFrozen = liveType === "individual";

  return (
    <div className="rounded-[var(--radius-xl)] border border-line bg-surface p-5" suppressHydrationWarning>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{t("yourShop")}</p>
        {locked ? (
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1 rounded-full border border-line bg-surface px-3 text-sm"
            onClick={startEdit}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Pencil className="size-3.5" />
            {t("edit")}
          </button>
        ) : null}
      </div>

      {locked ? (
        <div className="mt-3">
          <p className="font-medium">{savedName}</p>
          <p className="text-sm text-muted">{savedPhone || t("noPhone")}</p>
          <p className="mt-1 text-sm text-muted">
            {savedType === "individual" ? t("typeIndividual") : t("typeBusiness")}
            {savedType === "business" && savedIndustry ? ` · ${tradeLabel(savedIndustry)}` : ""}
            {savedType === "business" ? (savedVendor ? ` · ${t("listedVendor")}` : ` · ${t("asCustomer")}`) : ""}
          </p>
          {shopMsg ? <p className="mt-2 text-sm text-ok">{shopMsg}</p> : null}
        </div>
      ) : (
        <div className="mt-3">
          <label className="block text-xs text-muted">
            {t("accountType")}
            {typeFrozen ? ` · ${t("frozen")}` : ""}
          </label>
          <select
            value={liveType}
            disabled={typeFrozen}
            onChange={(e) => {
              const next = e.target.value === "individual" ? "individual" : "business";
              setTypeDraft(next);
              if (next === "individual") {
                setSellDraft(false);
                setIndustryDraft("");
              }
            }}
            className={typeFrozen ? frozenBox : box}
            style={typeFrozen ? frozenStyle : undefined}
          >
            <option value="business">{t("typeBusiness")}</option>
            <option value="individual">{t("typeIndividual")}</option>
          </select>
          <label className="mt-3 block text-xs text-muted">
            {liveType === "individual" ? t("fullName") : t("shopName")}
            {nameFrozen ? ` · ${t("frozen")}` : ""}
          </label>
          <input
            ref={nameRef}
            value={shopDraft}
            readOnly={nameFrozen}
            onChange={(e) => {
              setShopDraft(e.target.value);
              setShopMsg(null);
            }}
            className={nameFrozen ? frozenBox : box}
            style={nameFrozen ? frozenStyle : undefined}
          />
          <label className="mt-3 block text-xs text-muted">
            {t("loggedMobile")} · {t("frozen")}
          </label>
          <input readOnly value={loginTen.length === 10 ? formatInPhone(loginTen) : savedPhone} className={frozenBox} style={frozenStyle} />
          {liveType === "business" ? (
            <>
          <label className="mt-3 block text-xs text-muted">
            {t("yourTrade")}
            {extraFrozen ? ` · ${t("frozen")}` : ""}
          </label>
          <select
            value={industryDraft}
            disabled={extraFrozen}
            onChange={(e) => setIndustryDraft(e.target.value as Industry | "")}
            className={extraFrozen ? frozenBox : box}
            style={extraFrozen ? frozenStyle : undefined}
          >
            <option value="">{t("selectIndustry")}</option>
            {Object.keys(INDUSTRY_LABEL).map((k) => (
              <option key={k} value={k}>
                {tradeLabel(k as Industry)}
              </option>
            ))}
          </select>
          <label className="mt-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-line px-3 py-3 text-sm">
            <input type="checkbox" className="mt-1" checked={sellDraft} onChange={(e) => setSellDraft(e.target.checked)} />
            <span>
              <span className="font-medium">{t("sellOnVaaniShort")}</span>
              <span className="mt-0.5 block text-xs text-muted">{t("sellOnVaani")}</span>
            </span>
          </label>
            </>
          ) : (
            <p className="mt-3 text-xs text-muted">{t("individualHint")}</p>
          )}
          {shopMsg ? (
            <p className={`mt-3 text-sm ${shopMsg === t("shopSaved") ? "text-ok" : "text-danger"}`}>{shopMsg}</p>
          ) : null}
          <div className="mt-4 flex gap-2">
            <Button type="button" className="flex-1" onClick={saveShop}>
              {t("saveShop")}
            </Button>
            {savedName ? (
              <Button type="button" variant="outline" className="flex-1" onClick={stopEdit}>
                {t("cancel")}
              </Button>
            ) : null}
          </div>
        </div>
      )}
      {extra}
    </div>
  );
}

