import type { PaletteSource } from "@/components/layout/palette/types";
import { paletteJsonFetch } from "@/lib/data/http/palette-search.client";

const LIMIT = 5;

export const artistsPaletteSource: PaletteSource = {
  id: "artists",
  heading: "Artists",
  enabled: true,
  async search(query) {
    const q = query.trim();
    if (q.length < 2) return [];
    const qs = new URLSearchParams({ q, limit: String(LIMIT), offset: "0" });
    const body = await paletteJsonFetch<{
      data: { rows: { id: string; displayName: string }[] };
    }>("/admin/artists", qs);
    if (!body) return [];
    return body.data.rows.map((artist) => ({
      id: `artist-${artist.id}`,
      href: `/admin/artists/${artist.id}`,
      label: artist.displayName,
      hint: "Artist",
      kind: "record" as const,
    }));
  },
};
