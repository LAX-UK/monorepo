import type { ShopDeletionEligibilityService } from "./application/deletion-eligibility.service.js";
import type { SubjectExportService } from "./application/subject-export/subject-export.service.js";

/** What the machine-authenticated `/internal/identity` routes need. */
export type IdentityDeletionRouteDeps = {
  eligibility: ShopDeletionEligibilityService;
  /** The Identity machine client; unset means the boundary is closed (503), not open. */
  machine: { clientId: string | undefined; clientSecret: string | undefined };
};

/** What the machine-authenticated subject-export routes need; they use their own credential pair. */
export type IdentitySubjectExportRouteDeps = {
  exports: Pick<SubjectExportService, "manifest" | "page">;
  machine: { clientId: string | undefined; clientSecret: string | undefined };
};
