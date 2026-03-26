export function getUiLanguage(): string {
  return (chrome.i18n?.getUILanguage?.() || "en").toLowerCase();
}

export function getSupportedLocale(): "ja" | "en" {
  return getUiLanguage().startsWith("ja") ? "ja" : "en";
}

export function t(key: string, substitutions?: string | string[]): string {
  const message = chrome.i18n.getMessage(key, substitutions);
  return message || key;
}

export function applyDocumentLanguage(doc: Document = document): void {
  doc.documentElement.lang = getSupportedLocale();
}
