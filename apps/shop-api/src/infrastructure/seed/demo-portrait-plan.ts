import { DEMO_MEDIA_BASE_URL, demoPortraitUrl } from "@auction/db";

export type ArtistPortraitRow = { id: string; slug: string; portrait: string | null };

/** Stand-in portraits from earlier seeds and the copies this seed made before; real ones stay. */
const REPLACEABLE_PREFIXES = ["/art/seed/", "/shop/home/", `${DEMO_MEDIA_BASE_URL}/demo/portrait/`];

export function isReplaceablePortrait(portrait: string | null): boolean {
  const value = portrait?.trim() ?? "";
  return value === "" || REPLACEABLE_PREFIXES.some((prefix) => value.startsWith(prefix));
}

/**
 * Which artists get which portrait. Artists are numbered by slug across the whole directory, so an
 * artist keeps the same picture on every run and no two neighbours share one. An artist with a
 * portrait of their own is left as is.
 */
export function planDemoPortraits(
  artists: readonly ArtistPortraitRow[],
): { id: string; portrait: string }[] {
  const ordered = [...artists].sort((a, b) => a.slug.localeCompare(b.slug));
  const plan: { id: string; portrait: string }[] = [];
  for (const [index, artist] of ordered.entries()) {
    if (!isReplaceablePortrait(artist.portrait)) continue;
    const portrait = demoPortraitUrl(index);
    if (portrait !== artist.portrait) plan.push({ id: artist.id, portrait });
  }
  return plan;
}
