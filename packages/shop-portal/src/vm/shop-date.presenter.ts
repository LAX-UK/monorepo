import { formatDate, formatDateTime } from "@auction/datetime";

const SHOP_TIME_ZONE = "Europe/London";

/** "12 Nov 2026". */
export function formatShopDate(iso: string): string {
  return formatDate(new Date(iso), SHOP_TIME_ZONE);
}

/** "12 Nov 2026, 14:05". */
export function formatShopDateTime(iso: string): string {
  return formatDateTime(new Date(iso), SHOP_TIME_ZONE);
}
