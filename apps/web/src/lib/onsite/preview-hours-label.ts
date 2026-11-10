import { SITE_BUSINESS_HOURS_LABEL } from "@/lib/brand";
import { LONDON_TIME_ZONE, formatWhen } from "@auction/datetime";
import type { Sale } from "@auction/types";

/** Prefer sale-specific preview window; fall back to global site hours. */
export function formatOnsitePreviewHoursLabel(sale: Sale): string {
  const previewStart = sale.previewStartTime ? new Date(sale.previewStartTime) : null;
  const saleStart = new Date(sale.startTime);

  if (
    previewStart &&
    Number.isFinite(previewStart.getTime()) &&
    Number.isFinite(saleStart.getTime())
  ) {
    const previewStr = formatWhen(previewStart, LONDON_TIME_ZONE, new Date());
    const sessionStr = formatWhen(saleStart, LONDON_TIME_ZONE, new Date());
    return `Preview from ${previewStr} until session opens ${sessionStr}`;
  }

  return SITE_BUSINESS_HOURS_LABEL;
}
