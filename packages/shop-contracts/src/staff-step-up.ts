import { STAFF_STEP_UP_MAX_AGE_SECONDS } from "@auction/identity-contracts/staff-step-up";

/**
 * How recently a staff member must have signed in to move money or change who can sell or sign
 * in. shop-api enforces it on the routes below; the LAX Admin BFF checks the same list first so
 * the person is sent to sign in again instead of getting an error from the API.
 *
 * The window is the staff-wide one from `identity-contracts`, so both staff tools share it.
 */
export const SHOP_ADMIN_STEP_UP_MAX_AGE_SECONDS = STAFF_STEP_UP_MAX_AGE_SECONDS;

/**
 * Mutating routes that need a recent sign-in, as `/admin/v1` paths. A `:name` segment matches
 * any one segment, and a pattern also covers the paths beneath it. The shop-api route files
 * must call `requireRecentAuthentication` on exactly these routes; a test compares the two.
 */
export const SHOP_ADMIN_STEP_UP_PATHS = [
  "/admin/v1/refunds",
  "/admin/v1/payouts",
  "/admin/v1/sale-fees",
  "/admin/v1/fulfilment/possession",
  "/admin/v1/cancellations",
  "/admin/v1/original-sales/:originalSaleId/invoice",
  "/admin/v1/sale-authority-requests/:requestId/decision",
  "/admin/v1/artworks/:artworkId/sale-authority",
  "/admin/v1/guests/:guestCustomerId/erasure",
] as const;

function segmentsOf(path: string): string[] {
  return path.split("/").filter((segment) => segment.length > 0);
}

/** Whether `pathname` (an `/admin/v1` path, without a query) falls under `pattern`. */
export function stepUpPatternMatches(pattern: string, pathname: string): boolean {
  const patternSegments = segmentsOf(pattern);
  const pathSegments = segmentsOf(pathname);
  if (pathSegments.length < patternSegments.length) {
    return false;
  }
  return patternSegments.every(
    (segment, index) => segment.startsWith(":") || segment === pathSegments[index],
  );
}

export function isStepUpPath(pathname: string): boolean {
  return SHOP_ADMIN_STEP_UP_PATHS.some((pattern) => stepUpPatternMatches(pattern, pathname));
}
