import { Pencil } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { INDUSTRY_LABEL, LANGUAGES, formatInPhone, phoneDigits } from "@/lib/vaani/seed";
import { useT } from "@/lib/vaani/i18n";
import { readShopIdentity, useVaani } from "@/lib/vaani/store";
import type { Industry } from "@/lib/vaani/types";

export function ShopCard({ extra }: { extra?: ReactNode }) {
  const customerName = useVaani((s) => s.customerName);
  const customerPhone = useVaani((s) => s.customerPhone);
  const industry = useVaani((s) => s.industry);
  const isVendor = useVaani((s) => s.isVendor);
  const language = useVaani((s) => s.language);
  const shopSaved = useVaani((s) => s.shopSaved);
  const setShopIdentity = useVaani((s) => s.setShopIdentity);
  const setLanguage = useVaani((s) => s.setLanguage);
  const { t, industry: tradeLabel } = useT();

  const snap = readShopIdentity(customerPhone);
  const savedName = snap?.shopName || customerName;
  const savedPhone = formatInPhone(snap?.phone || customerPhone);
  const savedIndustry = snap?.industry || industry;
  const savedVendor = snap?.isVendor ?? isVendor;
  const savedLang = snap?.language || language || "hi-IN";
  const hasSaved = Boolean(savedName.trim()) && (shopSaved || Boolean(snap));
  const loginTen = phoneDigits(savedPhone);

  const [editing, setEditing] = useState(!hasSaved);
  const [shopDraft, setShopDraft] = useState(savedName);
  const [phoneDraft, setPhoneDraft] = useState(savedPhone);
  const [industryDraft, setIndustryDraft] = useState<Industry | "">(savedIndustry);
  const [sellDraft, setSellDraft] = useState(savedVendor);
  const [langDraft, setLangDraft] = useState(savedLang);
  const [shopMsg, setShopMsg] = useState<string | null>(null);
  const editClicked = useRef(false);

  useEffect(() => {
    if (hasSaved && !editClicked.current) setEditing(false);
  }, [hasSaved]);

  useEffect(() => {
    if (loginTen.length !== 10) return;
    setPhoneDraft((prev) => (phoneDigits(prev) === loginTen ? prev : formatInPhone(loginTen)));
  }, [loginTen]);

  useEffect(() => {
    if (editing) return;
    setShopDraft(savedName);
    setPhoneDraft(savedPhone);
    setIndustryDraft(savedIndustry);
    setSellDraft(savedVendor);
    setLangDraft(savedLang);
  }, [editing, savedName, savedPhone, savedIndustry, savedVendor, savedLang]);

  const locked = hasSaved && !editing;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const shopName = shopDraft.trim();
    if (!shopName) {
      setShopMsg(t("enterShopName"));
      return;
    }
    if (sellDraft && !industryDraft) {
      setShopMsg(t("pickTrade"));
      return;
    }
    const identity = {
      shopName,
      phone: loginTen.length === 10 ? formatInPhone(loginTen) : phoneDraft.trim(),
      industry: industryDraft,
      isVendor: sellDraft,
      language: langDraft,
    };
    setShopIdentity(identity);
    editClicked.current = false;
    setEditing(false);
    setShopMsg(t("shopSaved"));
  }

  return (
    <div className="rounded-[var(--radius-xl)] border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{t("yourShop")}</p>
        {locked ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setShopDraft(savedName);
              setPhoneDraft(savedPhone);
              setIndustryDraft(savedIndustry);
              setSellDraft(savedVendor);
              setLangDraft(savedLang);
              editClicked.current = true;
              setEditing(true);
              setShopMsg(null);
            }}
          >
            <Pencil className="size-3.5" />
            {t("edit")}
          </Button>
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
          {shopMsg ? (
            <p className={`mt-2 text-sm ${shopMsg === t("shopSaved") ? "text-ok" : "text-danger"}`}>
              {shopMsg}
            </p>
          ) : null}
        </div>
      ) : (
        <form className="mt-3" onSubmit={(e) => void onSubmit(e)}>
          <label className="block text-xs text-muted">{t("shopName")}</label>
          <input
            required
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
            value={loginTen.length === 10 ? formatInPhone(loginTen) : phoneDraft}
            onChange={(e) => {
              setPhoneDraft(e.target.value);
              setShopMsg(null);
            }}
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
            onChange={(e) => {
              setLangDraft(e.target.value);
              setLanguage(e.target.value);
            }}
            className="mt-1 h-11 w-full rounded-[var(--radius-md)] border border-line bg-bg px-3 text-sm"
          >
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
          <label className="mt-3 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={sellDraft}
              onChange={(e) => setSellDraft(e.target.checked)}
            />
            <span>{t("sellOnVaani")}</span>
          </label>
          <div className="mt-4 flex gap-2">
            <Button type="submit" className="flex-1">
              {t("saveShop")}
            </Button>
            {hasSaved ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShopDraft(savedName);
                  setPhoneDraft(savedPhone);
                  setIndustryDraft(savedIndustry);
                  setSellDraft(savedVendor);
                  setLangDraft(savedLang);
                  editClicked.current = false;
                  setEditing(false);
                  setShopMsg(null);
                }}
              >
                {t("cancel")}
              </Button>
            ) : null}
          </div>
          {shopMsg ? (
            <p className={`mt-2 text-sm ${shopMsg === t("shopSaved") ? "text-ok" : "text-danger"}`}>
              {shopMsg}
            </p>
          ) : null}
        </form>
      )}
      {extra}
    </div>
  );
}
