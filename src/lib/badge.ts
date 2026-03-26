import { t } from "./i18n.js";

export function badgeTextForRemaining(remaining: number): string {
  const unit = t("minutesUnit");
  if (remaining <= 0) return `0${unit}`;
  return `${remaining}${unit}`;
}
