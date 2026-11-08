import { RELEASE_READY_STAGES } from "@auction/domain";
import {
  type CapabilityRequirement,
  PRIVATE_SALE_DEALS_ALL_ACCESS,
  PRIVATE_SALE_DEALS_CHECKS_ACCESS,
  PRIVATE_SALE_DEALS_FINANCE_ACCESS,
  PRIVATE_SALE_DEALS_MANAGE_ACCESS,
  PRIVATE_SALE_DEALS_RELEASE_ACCESS,
} from "@auction/types";
import type { DealStaffViewer } from "./deal-staff-permissions.js";

/**
 * Turns what a person's capabilities allow into what the desk is told about them: which moves and
 * terms they may touch, which checks they may see, and which deals exist for them. The widest scope
 * they qualify for wins: every deal, else the deals they own, else only works waiting for release.
 */
export function dealViewerFrom(
  userId: string,
  can: (requirement: CapabilityRequirement) => boolean,
): DealStaffViewer {
  const manage = can(PRIVATE_SALE_DEALS_MANAGE_ACCESS);
  return {
    userId,
    abilities: {
      manage,
      finance: can(PRIVATE_SALE_DEALS_FINANCE_ACCESS),
      release: can(PRIVATE_SALE_DEALS_RELEASE_ACCESS),
    },
    checks: can(PRIVATE_SALE_DEALS_CHECKS_ACCESS),
    scope: can(PRIVATE_SALE_DEALS_ALL_ACCESS)
      ? { kind: "all" }
      : manage
        ? { kind: "owned", userId }
        : { kind: "stages", stages: RELEASE_READY_STAGES },
  };
}
