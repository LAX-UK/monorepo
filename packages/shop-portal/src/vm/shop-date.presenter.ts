const SHOP_DATE_LOCALE = "en-GB";
const SHOP_TIME_ZONE = "Europe/London";

export function formatShopDate(iso: string): string {
  return new Intl.DateTimeFormat(SHOP_DATE_LOCALE, {
    dateStyle: "medium",
    timeZone: SHOP_TIME_ZONE,
  }).format(new Date(iso));
}

export function formatShopDateTime(iso: string): string {
  return new Intl.DateTimeFormat(SHOP_DATE_LOCALE, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: SHOP_TIME_ZONE,
  }).format(new Date(iso));
}
