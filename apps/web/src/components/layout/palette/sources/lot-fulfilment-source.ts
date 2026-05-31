import { paletteApiBase } from "@/components/layout/palette/api-base";
import type { PaletteSource } from "@/components/layout/palette/types";

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
    const res = await fetch(`${paletteApiBase()}/admin/lot-fulfilment?${qs.toString()}`, {
      credentials: "include",
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { data: FulfilmentRow[] };
    return body.data.map((row) => ({
      id: `fulfilment-${row.id}`,
      href: `/admin/lot-fulfilment?q=${encodeURIComponent(row.lotId)}`,
      label: row.lotTitle ?? `Lot ${row.lotId.slice(0, 8)}…`,
      hint: row.status.replaceAll("_", " "),
    }));
  },
};
