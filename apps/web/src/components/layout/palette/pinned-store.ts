import type { PaletteEntityKind } from "@/components/layout/palette/recents-store";

export type PalettePinnedRef = {
  kind: PaletteEntityKind;
  id: string;
  label: string;
  href: string;
  pinnedAt: string;
};

const MAX_PINNED = 12;

export function togglePinned(
  list: readonly PalettePinnedRef[],
  entry: Omit<PalettePinnedRef, "pinnedAt">,
): PalettePinnedRef[] {
  const exists = list.find((p) => p.kind === entry.kind && p.id === entry.id);
  if (exists) {
    return list.filter((p) => !(p.kind === entry.kind && p.id === entry.id));
  }
  const pinnedAt = new Date().toISOString();
  return [{ ...entry, pinnedAt }, ...list].slice(0, MAX_PINNED);
}

export function parsePinnedCookie(raw: string | undefined | null): PalettePinnedRef[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as PalettePinnedRef[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (p) =>
          p &&
          typeof p.id === "string" &&
          typeof p.label === "string" &&
          typeof p.href === "string" &&
          typeof p.kind === "string",
      )
      .slice(0, MAX_PINNED);
  } catch {
    return [];
  }
}

export function serializePinnedCookie(list: readonly PalettePinnedRef[]): string {
  return JSON.stringify(list.slice(0, MAX_PINNED));
}
