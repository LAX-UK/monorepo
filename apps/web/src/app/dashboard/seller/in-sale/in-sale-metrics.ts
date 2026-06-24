import { PLATFORM_DEFAULT_CURRENCY, formatMoney } from "@/lib/format-currency";
import type { InSaleDisplayRow } from "./in-sale.vm";

function parseMoneyLabel(label: string): number {
  const n = Number.parseFloat(label.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function buildInSaleKpiTiles(rows: readonly InSaleDisplayRow[]) {
  const total = rows.length;
  const liveRows = rows.filter((r) => r.status === "active" || r.status === "scheduled");
  const reserveMet = liveRows.filter((r) => r.reserveMet && r.reserveLabel !== "No reserve").length;
  const sold = rows.filter((r) => r.saleOutcome === "sold").length;
  const passed = rows.filter((r) => r.saleOutcome === "passed").length;
  const prices = rows.map((r) => parseMoneyLabel(r.currentPriceLabel));
  const avgBid = total > 0 ? prices.reduce((a, b) => a + b, 0) / total : 0;

  return [
    {
      id: "total",
      label: "Total in sale",
      value: String(total),
      semanticTone: "emphasis" as const,
    },
    { id: "reserve", label: "Reserve met (live)", value: String(reserveMet) },
    { id: "sold", label: "Sold", value: String(sold) },
    { id: "passed", label: "Passed", value: String(passed) },
    {
      id: "avg",
      label: "Avg current bid",
      value:
        avgBid > 0 ? formatMoney(Math.round(avgBid).toFixed(0), PLATFORM_DEFAULT_CURRENCY) : "—",
    },
  ];
}
