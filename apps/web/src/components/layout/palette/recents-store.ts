export type PaletteEntityKind =
  | "lot"
  | "sale"
  | "client"
  | "artist"
  | "payment"
  | "invitation"
  | "route";

export type PaletteRecentRef = {
  kind: PaletteEntityKind;
  id: string;
  label: string;
  href: string;
  viewedAt: string;
};

const MAX_RECENTS = 8;

export function pushRecent(
  list: readonly PaletteRecentRef[],
  entry: Omit<PaletteRecentRef, "viewedAt"> & { viewedAt?: string },
): PaletteRecentRef[] {
  const viewedAt = entry.viewedAt ?? new Date().toISOString();
  const next: PaletteRecentRef = { ...entry, viewedAt };
  const withoutDup = list.filter((r) => !(r.kind === next.kind && r.id === next.id));
  return [next, ...withoutDup].slice(0, MAX_RECENTS);
}

export function parseRecentsCookie(raw: string | undefined | null): PaletteRecentRef[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as PaletteRecentRef[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (r) =>
          r &&
          typeof r.id === "string" &&
          typeof r.label === "string" &&
          typeof r.href === "string" &&
          typeof r.kind === "string",
      )
      .slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

export function serializeRecentsCookie(list: readonly PaletteRecentRef[]): string {
  return JSON.stringify(list.slice(0, MAX_RECENTS));
}
