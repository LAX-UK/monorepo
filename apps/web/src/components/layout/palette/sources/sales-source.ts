import type { PaletteSource } from "@/components/layout/palette/types";
import { paletteJsonFetch } from "@/lib/data/http/palette-search.client";

const LIMIT = 5;

export const salesPaletteSource: PaletteSource = {
  id: "sales",
  heading: "Sales",
  enabled: true,
  async search(query) {
    const q = query.trim();
    if (q.length < 2) return [];
    const qs = new URLSearchParams({ q, limit: String(LIMIT), offset: "0" });
    const body = await paletteJsonFetch<{ data: { sale: { id: string; title: string } }[] }>(
      "/sales",
      qs,
    );
    if (!body) return [];
    return body.data.map((row) => ({
      id: `sale-${row.sale.id}`,
      href: `/admin/sales/${row.sale.id}`,
      label: row.sale.title,
      hint: "Sale",
      kind: "record" as const,
    }));
  },
};
