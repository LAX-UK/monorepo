import { paletteRecordHint } from "@/components/layout/palette/palette-item-presenter";
import type { PaletteSource } from "@/components/layout/palette/types";
import { paletteJsonFetch } from "@/lib/data/http/palette-search.client";

const LIMIT = 5;

type PayoutRow = {
  id: string;
  legalEntityId: string;
  status: string;
  netAmount: string;
};

export const payoutsPaletteSource: PaletteSource = {
  id: "payouts",
  heading: "Payouts",
  enabled: true,
  async search(query) {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const qs = new URLSearchParams({ limit: "25", offset: "0" });
    const body = await paletteJsonFetch<{ data: PayoutRow[] }>("/admin/payouts", qs);
    if (!body) return [];
    return body.data
      .filter(
        (row) =>
          row.id.toLowerCase().includes(q) ||
          row.legalEntityId.toLowerCase().includes(q) ||
          row.status.toLowerCase().includes(q) ||
          row.netAmount.toLowerCase().includes(q),
      )
      .slice(0, LIMIT)
      .map((row) => ({
        id: `payout-${row.id}`,
        href: `/admin/payouts?legalEntityId=${encodeURIComponent(row.legalEntityId)}`,
        label: `Payout ${row.netAmount}`,
        hint: paletteRecordHint("record", row.status) ?? "Payout",
        kind: "record" as const,
      }));
  },
};
