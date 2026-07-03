import type { PaletteSource } from "@/components/layout/palette/types";
import { paletteJsonFetch } from "@/lib/data/http/palette-search.client";

const LIMIT = 5;

export const clientsPaletteSource: PaletteSource = {
  id: "clients",
  heading: "Clients",
  enabled: true,
  async search(query) {
    const q = query.trim();
    if (q.length < 2) return [];
    const qs = new URLSearchParams({ q, limit: String(LIMIT), offset: "0" });
    const body = await paletteJsonFetch<{
      data: { rows: { id: string; name: string; email: string }[] };
    }>("/admin/users", qs);
    if (!body) return [];
    return body.data.rows.map((user) => ({
      id: `client-${user.id}`,
      href: `/admin/clients/${user.id}`,
      label: user.name || user.email,
      hint: user.email || "Client",
      kind: "record" as const,
    }));
  },
};
