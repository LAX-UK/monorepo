/** Above this many articles the archive is long enough to need search and filters. */
export const PRESS_TOOLBAR_MIN_ARTICLES = 6;

export type PressPageState = {
  /** What the coverage section shows. */
  view: "empty" | "filteredEmpty" | "list";
  /** Search and filters appear only when they help: a long archive, or filters already applied. */
  showToolbar: boolean;
  /** The "N articles" line in the hero is hidden while there is nothing to count. */
  showHeroStats: boolean;
};

type Input = {
  /** Articles matching the current filters. */
  matchingCount: number;
  /** Every article in the archive, ignoring filters. */
  archiveTotal: number;
  hasActiveFilters: boolean;
};

export function resolvePressPageState({
  matchingCount,
  archiveTotal,
  hasActiveFilters,
}: Input): PressPageState {
  const view = matchingCount > 0 ? "list" : hasActiveFilters ? "filteredEmpty" : "empty";
  return {
    view,
    showToolbar: hasActiveFilters || archiveTotal > PRESS_TOOLBAR_MIN_ARTICLES,
    showHeroStats: archiveTotal > 0,
  };
}
