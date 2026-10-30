import type { AccessRequestView } from "@/lib/data/http/organisation-team.types";
import {
  organisationRoleLabel,
  organisationRoleRank,
} from "@/lib/presenters/organisation-role/organisation-role-presentation";
import { formatDateInline } from "@/lib/ui/format";
import { type EntityCapability, isEntityCapability, rolesWithCapability } from "@auction/domain";
import type { LegalEntityMemberRole } from "@auction/types";

/** One request waiting for an owner or admin, as its row shows it. */
export type AccessRequestRowView = {
  id: string;
  requesterName: string;
  /** "Asks to be Finance" or "Asks for more access". */
  ask: string;
  reason: string;
  /** "Asked 29 Oct 2026". */
  when: string;
  /**
   * Approving gives this role straight away; `null` means the approver chooses one of
   * `roleChoices` (a request for one capability).
   */
  role: LegalEntityMemberRole | null;
  roleChoices: { value: LegalEntityMemberRole; label: string }[];
  /** Nobody decides their own request. */
  isOwn: boolean;
};

/** The roles that hold a capability, least access first, without the owner role. */
function rolesFor(capability: EntityCapability): LegalEntityMemberRole[] {
  return rolesWithCapability(capability)
    .filter((role) => role !== "owner")
    .sort((a, b) => organisationRoleRank(b) - organisationRoleRank(a));
}

export function accessRequestRows(
  requests: readonly AccessRequestView[],
  viewerUserId: string,
): AccessRequestRowView[] {
  return requests
    .filter((request) => request.status === "pending")
    .map((request) => {
      const choices =
        request.requestedRole === null &&
        request.requestedCapability &&
        isEntityCapability(request.requestedCapability)
          ? rolesFor(request.requestedCapability)
          : [];
      return {
        id: request.id,
        requesterName: request.requesterName ?? "A member",
        ask: request.requestedRole
          ? `Asks to be ${organisationRoleLabel(request.requestedRole)}`
          : "Asks for more access",
        reason: request.reason,
        when: `Asked ${formatDateInline(request.createdAt)}`,
        role: request.requestedRole,
        roleChoices: choices.map((value) => ({ value, label: organisationRoleLabel(value) })),
        isOwn: request.requesterUserId === viewerUserId,
      };
    });
}

/**
 * The roles a member may ask for: those that hold what they could not open, above the role
 * they have. Least access first, so the smallest step is the first offered.
 */
export function askableRoles(
  current: LegalEntityMemberRole,
  capabilities: readonly EntityCapability[],
): LegalEntityMemberRole[] {
  const roles = new Set(capabilities.flatMap((capability) => rolesFor(capability)));
  roles.delete(current);
  return [...roles].sort((a, b) => organisationRoleRank(b) - organisationRoleRank(a));
}
