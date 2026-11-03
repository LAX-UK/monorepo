import type { ArtworkRegisterEntry } from "./entry.js";

/**
 * What a register record still lacks before it can be offered anywhere. Price is not here: the
 * asking price is set per place when the artwork is offered, so it is never a gap in the record.
 * An artist is always present, since Zoho Products without one never enter the register.
 */
export const CATALOGUE_GAPS = ["image", "size", "medium"] as const;
export type CatalogueGap = (typeof CATALOGUE_GAPS)[number];

function blank(value: string | null): boolean {
  return value === null || value.trim() === "";
}

type GapSubject = Pick<ArtworkRegisterEntry, "imageRefs" | "dimensions" | "medium">;

const GAP_CHECKS: Record<CatalogueGap, (entry: GapSubject) => boolean> = {
  image: (entry) => entry.imageRefs.length === 0,
  size: (entry) => blank(entry.dimensions),
  medium: (entry) => blank(entry.medium),
};

/** The gaps in a record, in the order of CATALOGUE_GAPS. Empty when it is complete. */
export function catalogueGapsOf(entry: GapSubject): CatalogueGap[] {
  return CATALOGUE_GAPS.filter((gap) => GAP_CHECKS[gap](entry));
}
