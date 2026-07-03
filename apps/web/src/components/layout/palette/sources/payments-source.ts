import { paletteRecordHint } from "@/components/layout/palette/palette-item-presenter";
import type { PaletteSource } from "@/components/layout/palette/types";
import { paletteJsonFetchPath } from "@/lib/data/http/palette-search.client";

const LIMIT = 5;

type PaymentRow = {
  id: string;
  lotTitle: string | null;
  buyerEmail: string | null;
  status: string;
};

/** Known gap: fetches the payments list then filters client-side until a search API exists. */
export const paymentsPaletteSource: PaletteSource = {
  id: "payments",
  heading: "Payments",
  enabled: true,
  async search(query) {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const body = await paletteJsonFetchPath<{ data: PaymentRow[] }>("/payments");
    if (!body) return [];
    return body.data
      .filter(
        (p) =>
          p.id.toLowerCase().includes(q) ||
          (p.lotTitle?.toLowerCase().includes(q) ?? false) ||
          (p.buyerEmail?.toLowerCase().includes(q) ?? false) ||
          p.status.toLowerCase().includes(q),
      )
      .slice(0, LIMIT)
      .map((p) => ({
        id: `payment-${p.id}`,
        href: `/admin/payments?q=${encodeURIComponent(p.id)}`,
        label: p.lotTitle ?? p.buyerEmail ?? p.id,
        hint: paletteRecordHint("record", p.status) ?? "Payment",
        kind: "record" as const,
      }));
  },
};
