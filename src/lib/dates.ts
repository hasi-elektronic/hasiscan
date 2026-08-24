import type { Lang } from "@/lib/i18n";

const locales: Record<Lang, string> = {
  tr: "tr-TR",
  de: "de-DE",
  en: "en-GB",
};

export function formatWhen(ts: number, lang: Lang): string {
  const diff = Date.now() - ts;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) {
    return lang === "de" ? "gerade eben" : lang === "en" ? "just now" : "şimdi";
  }
  if (minutes < 60) {
    return lang === "de"
      ? `vor ${minutes} Min.`
      : lang === "en"
        ? `${minutes}m ago`
        : `${minutes} dk`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return lang === "de"
      ? `vor ${hours} Std.`
      : lang === "en"
        ? `${hours}h ago`
        : `${hours} sa`;
  }
  return new Intl.DateTimeFormat(locales[lang], {
    day: "numeric",
    month: "short",
  }).format(ts);
}

export function formatDate(ts: number, lang: Lang): string {
  return new Intl.DateTimeFormat(locales[lang], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(ts);
}
