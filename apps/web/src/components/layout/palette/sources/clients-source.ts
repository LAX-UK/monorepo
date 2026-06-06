import { paletteApiBase } from "@/components/layout/palette/api-base";
import type { PaletteSource } from "@/components/layout/palette/types";

const LIMIT = 5;

export const clientsPaletteSource: PaletteSource = {
  id: "clients",
  heading: "Clients",
  enabled: true,
  async search(query) {
    const q = query.trim();
    if (q.length < 2) return [];
    const qs = new URLSearchParams({ q, limit: String(LIMIT), offset: "0" });
    const res = await fetch(`${paletteApiBase()}/admin/users?${qs.toString()}`, {
      credentials: "include",
    });
    if (!res.ok) return [];
    const body = (await res.json()) as {
      data: { rows: { id: string; name: string; email: string }[] };
    };
    return body.data.rows.map((user) => ({
      id: `client-${user.id}`,
      href: `/admin/clients/${user.id}`,
      label: user.name || user.email,
      hint: user.email || "Client",
      kind: "record" as const,
    }));
  },
};
