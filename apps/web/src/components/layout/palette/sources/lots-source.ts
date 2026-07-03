import type { PaletteSource } from "@/components/layout/palette/types";
import { paletteJsonFetch } from "@/lib/data/http/palette-search.client";

const LIMIT = 5;

export const lotsPaletteSource: PaletteSource = {
  id: "lots",
  heading: "Lots",
  enabled: true,
  async search(query) {
    const q = query.trim();
    if (q.length < 2) return [];
    const qs = new URLSearchParams({ q, limit: String(LIMIT), offset: "0" });
    const body = await paletteJsonFetch<{ data: { id: string; title: string }[] }>("/lots", qs);
    if (!body) return [];
    return body.data.map((lot) => ({
      id: `lot-${lot.id}`,
      href: `/admin/lots/${lot.id}`,
      label: lot.title,
      hint: "Lot",
      kind: "record" as const,
    }));
  },
};
