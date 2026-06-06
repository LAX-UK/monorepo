import { paletteApiBase } from "@/components/layout/palette/api-base";
import type { PaletteSource } from "@/components/layout/palette/types";

const LIMIT = 5;

export const lotsPaletteSource: PaletteSource = {
  id: "lots",
  heading: "Lots",
  enabled: true,
  async search(query) {
    const q = query.trim();
    if (q.length < 2) return [];
    const qs = new URLSearchParams({ q, limit: String(LIMIT), offset: "0" });
    const res = await fetch(`${paletteApiBase()}/lots?${qs.toString()}`, {
      credentials: "include",
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { data: { id: string; title: string }[] };
    return body.data.map((lot) => ({
      id: `lot-${lot.id}`,
      href: `/admin/lots/${lot.id}`,
      label: lot.title,
      hint: "Lot",
      kind: "record" as const,
    }));
  },
};
