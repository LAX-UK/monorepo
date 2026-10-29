import { organisationRoleLabel } from "@/lib/presenters/organisation-role/organisation-role-presentation";
import { entityActorCan, sellerSubmissionAccess } from "@auction/domain";
import type { LegalEntitySummary } from "@auction/types";

/** One choice in "Who is selling?". */
export type SellerAccountOption = {
  id: string;
  kind: "personal" | "organisation";
  name: string;
  /** The person's role, shown after an organisation's name ("Admin"). */
  roleLabel: string | null;
  canSubmit: boolean;
  /** Why this account can save a draft but not submit yet. */
  submitBlockedReason: string | null;
};

export type SellerAccountChoice = {
  options: SellerAccountOption[];
  /** Preselected: the account in use when it is one of the options, else Personal. */
  defaultId: string | null;
};

/**
 * The accounts a person may sell as: always their own profile, and each organisation where
 * their role may hand in work. An organisation that cannot take submissions at all (closed or
 * rejected) is left out; one still under review is offered for drafts and says why it cannot
 * submit yet.
 */
export function sellerAccountChoice(input: {
  memberships: readonly LegalEntitySummary[];
  personalName: string;
  actingId: string | null;
}): SellerAccountChoice {
  const options: SellerAccountOption[] = [];
  for (const membership of input.memberships) {
    if (membership.isImpersonation) continue;
    if (membership.kind === "individual") {
      const access = sellerSubmissionAccess(membership);
      if (!access.canDraft) continue;
      options.unshift({
        id: membership.id,
        kind: "personal",
        name: input.personalName,
        roleLabel: null,
        canSubmit: access.canSubmit,
        submitBlockedReason: access.submitBlockedReason,
      });
      continue;
    }
    if (!entityActorCan({ role: membership.role }, "entity.submissions.create")) continue;
    const access = sellerSubmissionAccess(membership);
    if (!access.canDraft) continue;
    options.push({
      id: membership.id,
      kind: "organisation",
      name: membership.displayName,
      roleLabel: organisationRoleLabel(membership.role),
      canSubmit: access.canSubmit,
      submitBlockedReason: access.submitBlockedReason,
    });
  }
  const acting = options.find((option) => option.id === input.actingId);
  const personal = options.find((option) => option.kind === "personal");
  return { options, defaultId: acting?.id ?? personal?.id ?? options[0]?.id ?? null };
}
