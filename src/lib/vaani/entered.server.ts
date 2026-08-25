import { getCookie } from "@tanstack/react-start/server";

export function readVaaniCookieTen() {
  try {
    const c = getCookie("vaani_phone");
    const ten = typeof c === "string" ? c.replace(/\D/g, "").slice(-10) : "";
    return ten.length === 10 ? ten : "";
  } catch {
    return "";
  }
}
