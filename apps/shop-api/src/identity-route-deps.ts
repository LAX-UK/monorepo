import type { ShopDeletionEligibilityService } from "./application/deletion-eligibility.service.js";

/** What the machine-authenticated `/internal/identity` routes need. */
export type IdentityDeletionRouteDeps = {
  eligibility: ShopDeletionEligibilityService;
  /** The Identity machine client; unset means the boundary is closed (503), not open. */
  machine: { clientId: string | undefined; clientSecret: string | undefined };
};
