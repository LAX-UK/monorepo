import type { LegalEntityKind, LegalEntityStatus } from "@auction/types";
import type { EntityCapability } from "./entity-capabilities.js";
import {
  ORGANISATION_ACTIONS,
  type OrganisationAction,
  type OrganisationStatePolicy,
  organisationStatePolicy,
} from "./organisation-state-policy.js";
import { INDIVIDUAL_SUBMISSION_BLOCKED_STATUSES } from "./submission-policy.js";

/** The account a member acts for, as far as its state goes. */
export type AccountStanding = {
  /** Absent reads as an organisation. */
  kind?: LegalEntityKind;
  status: LegalEntityStatus;
  payoutsReady: boolean;
};

/** Actions that exist only for an organisation: its team, and the documents LAX checks. */
const ORGANISATION_ONLY: ReadonlySet<OrganisationAction> = new Set([
  "invite",
  "accept_invitation",
  "send_documents",
]);

/** What a closed personal account still allows: reading its history. */
const PERSONAL_CLOSED: ReadonlySet<OrganisationAction> = new Set(["read_history"]);

function personalActions(status: LegalEntityStatus): Record<OrganisationAction, boolean> {
  const closed = INDIVIDUAL_SUBMISSION_BLOCKED_STATUSES.has(status);
  return Object.fromEntries(
    ORGANISATION_ACTIONS.map((action) => [
      action,
      closed ? PERSONAL_CLOSED.has(action) : !ORGANISATION_ONLY.has(action),
    ]),
  ) as Record<OrganisationAction, boolean>;
}

/**
 * What the account's state allows. An organisation follows its review and status (see
 * {@link organisationStatePolicy}); a person's own account is never under an organisation's
 * review, so it stays open until it is closed, the same rule submissions follow.
 */
export function accountStatePolicy(
  account: AccountStanding,
  capabilities: ReadonlySet<EntityCapability>,
): OrganisationStatePolicy {
  if (account.kind !== "individual") {
    return organisationStatePolicy(account.status, capabilities, {
      payoutsReady: account.payoutsReady,
    });
  }
  const closed = INDIVIDUAL_SUBMISSION_BLOCKED_STATUSES.has(account.status);
  return {
    status: account.status,
    actions: personalActions(account.status),
    banner: null,
    homeFirstRunKey: closed ? "closed" : "ready",
    bidPanelReasonKey: null,
  };
}
