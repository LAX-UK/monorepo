/**
 * The cover review page shows every design scenario on fixture data, for screenshots and axe
 * runs. It exists only outside production builds.
 */
export const COVER_FIXTURE_REVIEW_PATH = "/dev/cover";

/** Whether the review page may be served: local development and test runs only. */
export function isCoverFixtureReviewAvailable(nodeEnv: string | undefined): boolean {
  return nodeEnv !== "production";
}
