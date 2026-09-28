/**
 * @param {Array<{ createdAt: string }>} successesNewestFirst
 * @returns {{ createdAt: string } | undefined}
 */
export function latestSuccessfulSoakRun(successesNewestFirst) {
  return successesNewestFirst[0];
}
