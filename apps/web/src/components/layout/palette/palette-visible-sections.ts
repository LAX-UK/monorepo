import { dedupePaletteSections } from "@/components/layout/palette/palette-item-presenter";
import type { PaletteSection } from "@/components/layout/palette/types";

const EPHEMERAL_SECTION_IDS = new Set(["pinned", "recents", "suggested"]);
const SEARCH_HIDDEN_SECTION_IDS = new Set([...EPHEMERAL_SECTION_IDS, "quick-actions"]);

export function buildVisiblePaletteSections(
  staticSections: readonly PaletteSection[],
  asyncSections: readonly PaletteSection[],
  query: string,
): PaletteSection[] {
  const q = query.trim();

  if (q.length === 0) {
    return dedupePaletteSections(staticSections);
  }

  if (q.length === 1) {
    return dedupePaletteSections(
      staticSections.filter((section) => !EPHEMERAL_SECTION_IDS.has(section.id)),
    );
  }

  const pages = staticSections.filter((section) => !SEARCH_HIDDEN_SECTION_IDS.has(section.id));
  const actions = staticSections.filter((section) => section.id === "actions");
  const nonEmptyAsync = asyncSections.filter((section) => section.items.length > 0);

  return dedupePaletteSections([...pages, ...actions, ...nonEmptyAsync]);
}
