/**
 * The cover review page shows every design scenario on fixture data, for screenshots and axe
 * runs. It exists only outside production builds.
 */
export const COVER_FIXTURE_REVIEW_PATH = "/dev/cover";

/**
 * Whether the review page may be served: local development and test runs, or a production build
 * started on purpose for the visual tests with `COVER_FIXTURE_REVIEW=1`. No deployed environment
 * sets that variable.
 */
export function isCoverFixtureReviewAvailable(
  nodeEnv: string | undefined,
  optIn: string | undefined = undefined,
): boolean {
  return nodeEnv !== "production" || optIn === "1";
}
