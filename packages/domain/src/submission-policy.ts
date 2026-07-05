import type { LegalEntityStatus } from "@auction/types";

export const SELLER_ENTITY_WRITE_STATUSES = new Set<LegalEntityStatus>(["approved", "restricted"]);

export const INDIVIDUAL_SUBMISSION_BLOCKED_STATUSES = new Set<LegalEntityStatus>([
  "rejected",
  "archived",
]);
