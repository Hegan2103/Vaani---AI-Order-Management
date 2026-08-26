import { Pencil } from "lucide-react";
import { useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { INDUSTRY_LABEL, LANGUAGES, formatInPhone, phoneDigits } from "@/lib/vaani/seed";
import { useT } from "@/lib/vaani/i18n";
import { liveLoginTen, readLoginTen, readShopIdentity, useVaani, type ShopIdentity } from "@/lib/vaani/store";
import type { Industry } from "@/lib/vaani/types";

const PIN_KEY = "vaani-shop-locked";
let LOCKED: ShopIdentity | null = null;
let EDITING = false;

function remember(p: Partial<ShopIdentity> | null | undefined) {
  const shopName = (p?.shopName || LOCKED?.shopName || "").trim();
  if (!shopName) return LOCKED;
  LOCKED = {
    shopName,
    phone: p?.phone || LOCKED?.phone || "",
    industry: p?.industry || LOCKED?.industry || "",
    isVendor: Boolean(p?.isVendor || LOCKED?.isVendor),
    language: p?.language || LOCKED?.language || "en-IN",
  };
  try {
    sessionStorage.setItem(PIN_KEY, JSON.stringify(LOCKED));
    localStorage.setItem(PIN_KEY, JSON.stringify(LOCKED));
  } catch {
    /* ignore */
  }
  return LOCKED;
}

function pullIdentity() {
  if (typeof window === "undefined") return LOCKED;
  try {
    const raw = sessionStorage.getItem(PIN_KEY) || localStorage.getItem(PIN_KEY) || "";
    if (raw) remember(JSON.parse(raw) as ShopIdentity);
  } catch {
    /* ignore */
  }
  remember(readShopIdentity(liveLoginTen() || readLoginTen()));
  const s = useVaani.getState();
  remember({
    shopName: s.customerName,
    phone: s.customerPhone,
    industry: s.industry,
    isVendor: s.isVendor,
    language: s.language,
  });
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
  const [shopMsg, setShopMsg] = useState<string | null>(null);

  useLayoutEffect(() => {
    const next = pullIdentity();
    if (next) {
      setId(next);
      if (!EDITING) {
        setShopDraft(next.shopName);
        setIndustryDraft(next.industry || "");
        setSellDraft(Boolean(next.isVendor));
        setLangDraft(next.language || "en-IN");
      }
    }
  }, []);

  const shown = id || LOCKED;
  const loginTen = liveLoginTen() || readLoginTen() || phoneDigits(shown?.phone || "");
  const savedName = (shown?.shopName || "").trim();
  const savedPhone = formatInPhone(shown?.phone || loginTen);
  const savedIndustry = shown?.industry || "";
  const savedVendor = Boolean(shown?.isVendor);
  const savedLang = shown?.language || "en-IN";
  const locked = Boolean(savedName) && !editing;

  function startEdit(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setShopDraft(savedName);
    setIndustryDraft(savedIndustry);
    setSellDraft(savedVendor);
    setLangDraft(savedLang);
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
    const identity: ShopIdentity = {
      shopName,
      phone: loginTen.length === 10 ? formatInPhone(loginTen) : savedPhone,
      industry: industryDraft,
      isVendor: sellDraft,
      language: langDraft || "en-IN",
    };
    remember(identity);
    setId(identity);
    setShopIdentity(identity);
    EDITING = false;
    setEditing(false);
    setShopMsg(t("shopSaved"));
  }

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
            {savedIndustry ? tradeLabel(savedIndustry) : t("tradeNotSet")}
            {savedVendor ? ` · ${t("listedVendor")}` : ` · ${t("asCustomer")}`}
            {` · ${LANGUAGES.find((l) => l.id === savedLang)?.label ?? savedLang}`}
          </p>
          {shopMsg ? <p className="mt-2 text-sm text-ok">{shopMsg}</p> : null}
        </div>
      ) : (
        <div className="mt-3">
          <label className="block text-xs text-muted">{t("shopName")}</label>
          <input
            ref={nameRef}
            value={shopDraft}
            onChange={(e) => {
              setShopDraft(e.target.value);
              setShopMsg(null);
            }}
            className="mt-1 h-11 w-full rounded-[var(--radius-md)] border border-line bg-bg px-3 text-sm"
          />
          <label className="mt-3 block text-xs text-muted">{t("loggedMobile")}</label>
          <input
            readOnly
            value={loginTen.length === 10 ? formatInPhone(loginTen) : savedPhone}
            className="mt-1 h-11 w-full rounded-[var(--radius-md)] border border-line bg-bg px-3 text-sm text-muted"
          />
          <label className="mt-3 block text-xs text-muted">{t("yourTrade")}</label>
          <select
            value={industryDraft}
            onChange={(e) => setIndustryDraft(e.target.value as Industry | "")}
            className="mt-1 h-11 w-full rounded-[var(--radius-md)] border border-line bg-bg px-3 text-sm"
          >
            <option value="">{t("selectIndustry")}</option>
            {Object.keys(INDUSTRY_LABEL).map((k) => (
              <option key={k} value={k}>
                {tradeLabel(k as Industry)}
              </option>
            ))}
          </select>
          <label className="mt-3 block text-xs text-muted">{t("language")}</label>
          <select
            value={langDraft}
            onChange={(e) => setLangDraft(e.target.value)}
            className="mt-1 h-11 w-full rounded-[var(--radius-md)] border border-line bg-bg px-3 text-sm"
          >
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
          <label className="mt-3 flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={sellDraft} onChange={(e) => setSellDraft(e.target.checked)} />
            <span>{t("sellOnVaani")}</span>
          </label>
          {shopMsg ? (
            <p className={`mt-3 text-sm ${shopMsg === t("shopSaved") ? "text-ok" : "text-danger"}`}>{shopMsg}</p>
          ) : null}
          <div className="mt-4 flex gap-2">
            <Button type="button" className="flex-1" onClick={saveShop}>
              {t("saveShop")}
            </Button>
            {savedName ? (
              <Button type="button" variant="outline" onClick={stopEdit}>
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
