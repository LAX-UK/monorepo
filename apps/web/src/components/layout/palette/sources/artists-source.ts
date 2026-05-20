import { paletteApiBase } from "@/components/layout/palette/api-base";
import type { PaletteSource } from "@/components/layout/palette/types";

const LIMIT = 5;

export const artistsPaletteSource: PaletteSource = {
  id: "artists",
  heading: "Artists",
  enabled: true,
  async search(query) {
    const q = query.trim();
    if (q.length < 2) return [];
    const qs = new URLSearchParams({ q, limit: String(LIMIT), offset: "0" });
    const res = await fetch(`${paletteApiBase()}/admin/artists?${qs.toString()}`, {
      credentials: "include",
    });
    if (!res.ok) return [];
    const body = (await res.json()) as {
      data: { rows: { id: string; displayName: string }[] };
    };
    return body.data.rows.map((artist) => ({
      id: `artist-${artist.id}`,
      href: `/admin/artists/${artist.id}`,
      label: artist.displayName,
      hint: "Artist",
    }));
  },
};
