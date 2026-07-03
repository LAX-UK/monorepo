import { paletteRecordHint } from "@/components/layout/palette/palette-item-presenter";
import type { PaletteSource } from "@/components/layout/palette/types";
import { paletteJsonFetch } from "@/lib/data/http/palette-search.client";

const LIMIT = 5;

type FulfilmentRow = {
  id: string;
  lotId: string;
  lotTitle: string | null;
  status: string;
};

export const lotFulfilmentPaletteSource: PaletteSource = {
  id: "lot-fulfilment",
  heading: "Lot fulfilment",
  enabled: true,
  async search(query) {
    const q = query.trim();
    if (q.length < 2) return [];
    const qs = new URLSearchParams({ q, limit: String(LIMIT), offset: "0" });
    const body = await paletteJsonFetch<{ data: FulfilmentRow[] }>("/admin/lot-fulfilment", qs);
    if (!body) return [];
    return body.data.map((row) => ({
      id: `fulfilment-${row.id}`,
      href: `/admin/lot-fulfilment?q=${encodeURIComponent(row.lotId)}`,
      label: row.lotTitle ?? `Lot ${row.lotId.slice(0, 8)}…`,
      hint: paletteRecordHint("record", row.status) ?? "Fulfilment",
      kind: "record" as const,
    }));
  },
};
