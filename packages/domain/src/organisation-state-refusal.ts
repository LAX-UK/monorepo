import type { LegalEntityStatus } from "@auction/types";
import {
  type OrganisationBidReasonKey,
  organisationStateAllows,
  organisationStatePolicy,
} from "./organisation-state-policy.js";

/** What a person is told when the organisation's state stops them bidding or registering. */
const REFUSAL_MESSAGE: Record<OrganisationBidReasonKey, string> = {
  documents_requested:
    "Bidding opens once the organisation's documents have been sent and checked.",
  documents_under_review:
    "Bidding opens once we've finished checking the organisation's documents.",
  restricted: "Bidding is paused for this organisation. Contact LAX to find out why.",
  not_approved: "This organisation wasn't approved to bid.",
  archived: "This organisation is closed and can't bid.",
};

/**
 * The message for refusing to bid or register for an organisation in `status`, or `null` when
 * both are open. Bidding and registering share one rule, so they share one message.
 */
export function organisationBidRefusalMessage(status: LegalEntityStatus): string | null {
  if (organisationStateAllows(status, "bid") && organisationStateAllows(status, "register")) {
    return null;
  }
  const key = organisationStatePolicy(status, new Set()).bidPanelReasonKey;
  return key ? REFUSAL_MESSAGE[key] : null;
}
