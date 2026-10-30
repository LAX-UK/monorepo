/**
 * The client-density component sheet, for reviewing the client workspace's elements without staff
 * access. It exists only outside production builds.
 */
export const CLIENT_KIT_REVIEW_PATH = "/dev/kit";

/** Whether the review page may be served: local development and test runs only. */
export function isClientKitReviewAvailable(nodeEnv: string | undefined): boolean {
  return nodeEnv !== "production";
}
