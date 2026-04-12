import type { ArtistProfile } from "@/lib/data/contracts";

/** Eyebrow line for cards: explicit discipline or uppercase Medium stat. */
export function artistEyebrowText(profile: ArtistProfile): string | null {
  if (profile.discipline?.trim()) {
    return profile.discipline.trim().toUpperCase();
  }
  const medium = profile.stats.find((s) => s.label === "Medium");
  if (medium?.value?.trim()) {
    return medium.value.trim().toUpperCase();
  }
  return null;
}
