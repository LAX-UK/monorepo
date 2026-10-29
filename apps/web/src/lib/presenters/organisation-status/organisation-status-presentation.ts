import type { LegalEntityStatus } from "@auction/types";
import type { StatusBadgeTone } from "@auction/ui/components/status-badge";

/**
 * An organisation's state as its members read it: the badge on the Organisation page and Your
 * organisations, and the short note in the account switcher. Clients never see the review
 * pipeline's own names ("Connect pending", "lead"); staff tools keep those in their own labels.
 * Every state has an entry, so a new one fails to compile until it has words.
 */
export type OrganisationStatusView = {
  label: string;
  tone: StatusBadgeTone;
  /** Shown after the role in the account switcher ("Admin · Under review"); `null` for none. */
  switcherNote: string | null;
};

const STATUS_VIEWS: Record<LegalEntityStatus, OrganisationStatusView> = {
  lead: { label: "Getting started", tone: "neutral", switcherNote: null },
  docs_requested: { label: "Documents needed", tone: "warning", switcherNote: "Documents needed" },
  docs_received: { label: "Under review", tone: "info", switcherNote: "Under review" },
  under_review: { label: "Under review", tone: "info", switcherNote: "Under review" },
  connect_pending: { label: "Setting up payouts", tone: "warning", switcherNote: null },
  approved: { label: "Approved", tone: "success", switcherNote: null },
  restricted: { label: "Restricted", tone: "danger", switcherNote: "Restricted" },
  rejected: { label: "Not approved", tone: "danger", switcherNote: "Not approved" },
  archived: { label: "Closed", tone: "neutral", switcherNote: "Closed" },
};

export function organisationStatusView(status: LegalEntityStatus): OrganisationStatusView {
  return STATUS_VIEWS[status];
}
