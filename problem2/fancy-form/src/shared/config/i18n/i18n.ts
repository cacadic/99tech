import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import vi from "./locales/vi.json";

export const supportedLngs = ["en", "vi"] as const;
export type Language = (typeof supportedLngs)[number];

/** Locale codes written by earlier versions. `vn` is not an ISO 639 code; Vietnamese is `vi`. */
const LEGACY_LANGUAGE_CODES: Readonly<Record<string, string>> = { vn: "vi" };

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    // Translations ship in the bundle: no network round-trip, so no flash of untranslated keys.
    resources: { en: { translation: en }, vi: { translation: vi } },
    initAsync: false,
    fallbackLng: "en",
    supportedLngs,
    nonExplicitSupportedLngs: true,
    load: "languageOnly",
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      // Migrates a stored legacy `vn` selection (and maps `vi-VN` etc. to `vi`).
      convertDetectedLanguage: (language: string) => {
        const base = language.split("-")[0] ?? language;
        return LEGACY_LANGUAGE_CODES[base] ?? base;
      },
    },
  });

const syncDocumentLanguage = (language: string): void => {
  document.documentElement.lang = language.split("-")[0] ?? "en";
};
syncDocumentLanguage(i18n.resolvedLanguage ?? "en");
i18n.on("languageChanged", syncDocumentLanguage);

/** The active supported language: always `en` or `vi`, never a regional variant. */
export function currentLanguage(): Language {
  return i18n.resolvedLanguage === "vi" ? "vi" : "en";
}

export default i18n;
