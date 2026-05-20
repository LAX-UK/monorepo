import { paletteApiBase } from "@/components/layout/palette/api-base";
import type { PaletteSource } from "@/components/layout/palette/types";

const LIMIT = 5;

type PaymentRow = {
  id: string;
  lotTitle: string | null;
  buyerEmail: string | null;
  status: string;
};

export const paymentsPaletteSource: PaletteSource = {
  id: "payments",
  heading: "Payments",
  enabled: true,
  async search(query) {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const res = await fetch(`${paletteApiBase()}/payments`, { credentials: "include" });
    if (!res.ok) return [];
    const body = (await res.json()) as { data: PaymentRow[] };
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
        href: `/admin/payments?highlight=${encodeURIComponent(p.id)}`,
        label: p.lotTitle ?? p.buyerEmail ?? p.id,
        hint: p.status,
      }));
  },
};
