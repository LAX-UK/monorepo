/** Which catalogue controls a sale of this size earns. One table, so the thresholds live in one place. */
export const CATALOGUE_CONTROL_THRESHOLDS = {
  /** Status chips, sort, the view switcher and the count appear from this many lots. */
  toolbar: 12,
  /** Search by title appears from this many lots. */
  search: 40,
} as const;

export type CatalogueControls = {
  toolbar: boolean;
  search: boolean;
};

/**
 * Controls appear only when they can change something. Under the toolbar threshold the catalogue
 * is the lots alone. Read from the sale's whole lot count, never from a filtered view, so a person
 * who narrowed the list always keeps the controls to widen it again.
 */
export function catalogueControls(lotCount: number): CatalogueControls {
  return {
    toolbar: lotCount >= CATALOGUE_CONTROL_THRESHOLDS.toolbar,
    search: lotCount >= CATALOGUE_CONTROL_THRESHOLDS.search,
  };
}
