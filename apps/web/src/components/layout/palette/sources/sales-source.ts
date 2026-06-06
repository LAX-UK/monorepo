import { paletteApiBase } from "@/components/layout/palette/api-base";
import type { PaletteSource } from "@/components/layout/palette/types";

const LIMIT = 5;

export const salesPaletteSource: PaletteSource = {
  id: "sales",
  heading: "Sales",
  enabled: true,
  async search(query) {
    const q = query.trim();
    if (q.length < 2) return [];
    const qs = new URLSearchParams({ q, limit: String(LIMIT), offset: "0" });
    const res = await fetch(`${paletteApiBase()}/sales?${qs.toString()}`, {
      credentials: "include",
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { data: { sale: { id: string; title: string } }[] };
    return body.data.map((row) => ({
      id: `sale-${row.sale.id}`,
      href: `/admin/sales/${row.sale.id}`,
      label: row.sale.title,
      hint: "Sale",
      kind: "record" as const,
    }));
  },
};
