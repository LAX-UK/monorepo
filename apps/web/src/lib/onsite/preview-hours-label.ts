import { SITE_BUSINESS_HOURS_LABEL } from "@/lib/brand";
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
    const previewStr = previewStart.toLocaleString("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    const sessionStr = saleStart.toLocaleString("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    return `Preview from ${previewStr} until session opens ${sessionStr}`;
  }

  return SITE_BUSINESS_HOURS_LABEL;
}
