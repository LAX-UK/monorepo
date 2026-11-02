/** How many of each thing a home section shows, and the fewest that make it worth showing. */
export const HOME_SECTION_LIMITS = {
  /** Rails show whole rows of four. */
  lotRail: { max: 8, min: 4, row: 4 },
  resultsLots: { max: 4, min: 4 },
  comingUp: { max: 4, min: 1 },
  departments: { max: 6, min: 3 },
  artists: { max: 4, min: 3 },
  press: { max: 3, min: 2 },
} as const;
