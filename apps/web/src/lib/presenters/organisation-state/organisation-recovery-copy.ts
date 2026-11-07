import type { OrganisationAbilityKey, OrganisationRecoveryKind } from "@auction/domain";
import type { StatusBadgeTone } from "@auction/ui/components/status-badge";

/**
 * The words for the recovery panel on Home and the Organisation page. The domain decides which
 * abilities are open for a status; this module only says them. Every key has an entry, so a new
 * one fails to compile until it has words.
 */

export const RECOVERY_HEADING = "What you can do now";

/** What each ability is, in the member's terms. */
export const ABILITY_LABEL: Readonly<Record<OrganisationAbilityKey, string>> = {
  history: "Read sales, purchases and invoices",
  pay: "Pay invoices already issued",
  trade: "Bid, register and send works",
};

export type RecoveryTag = { label: string; tone: StatusBadgeTone };

export const OPEN_TAG: RecoveryTag = { label: "Available", tone: "success" };

/** How a closed ability reads: paused while restricted, waiting while documents are checked. */
export const CLOSED_TAG: Readonly<Record<OrganisationRecoveryKind, RecoveryTag>> = {
  documents_requested: { label: "Opens once checked", tone: "neutral" },
  documents_under_review: { label: "Opens once checked", tone: "neutral" },
  restricted: { label: "Paused", tone: "warning" },
  not_approved: { label: "Not available", tone: "neutral" },
};

export const DOCUMENTS_HEADING = "Documents we asked for";

/** The button that keeps the person buying as themselves. */
export const KEEP_BIDDING_LABEL = "Keep bidding as yourself";

/** Said before the LAX message in the banner. */
export const LAX_MESSAGE_LABEL = "Message from LAX";

/** Where the check is, from the day the latest document arrived. */
export const documentsReceivedLine = (date: string) => `Documents received on ${date}.`;

export const REVIEW_TAKING_LONG = "Waiting longer than 3 working days?";
