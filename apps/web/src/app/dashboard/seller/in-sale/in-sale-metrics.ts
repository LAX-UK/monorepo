import { PLATFORM_DEFAULT_CURRENCY, formatMoney } from "@/lib/format-currency";
import type { InSaleDisplayRow } from "./in-sale.vm";

function parseMoneyLabel(label: string): number {
  const n = Number.parseFloat(label.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function buildInSaleKpiTiles(rows: readonly InSaleDisplayRow[]) {
  const total = rows.length;
  const reserveMet = rows.filter((r) => r.reserveMet && r.reserveLabel !== "No reserve").length;
  const hammered = rows.filter((r) => r.status === "ended").length;
  const prices = rows.map((r) => parseMoneyLabel(r.currentPriceLabel));
  const avgBid = total > 0 ? prices.reduce((a, b) => a + b, 0) / total : 0;

  return [
    {
      id: "total",
      label: "Total in sale",
      value: String(total),
      semanticTone: "emphasis" as const,
    },
    { id: "reserve", label: "Reserve met", value: String(reserveMet) },
    { id: "hammer", label: "Hammered", value: String(hammered) },
    {
      id: "avg",
      label: "Avg current bid",
      value:
        avgBid > 0 ? formatMoney(Math.round(avgBid).toFixed(0), PLATFORM_DEFAULT_CURRENCY) : "—",
    },
  ];
}
