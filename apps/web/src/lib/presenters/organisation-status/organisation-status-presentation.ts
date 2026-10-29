import type { LegalEntityStatus } from "@auction/types";
import type { StatusBadgeTone } from "@auction/ui/components/status-badge";

/**
 * An organisation's state as its members read it: the badge on the Organisation page and Your
 * organisations, the short note in the account switcher, and the title of the state banner, so
 * one state has one name everywhere. Clients never see the review
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
  // A new organisation is asked for its documents straight away, so it reads the same.
  lead: { label: "Documents requested", tone: "warning", switcherNote: "Documents requested" },
  docs_requested: {
    label: "Documents requested",
    tone: "warning",
    switcherNote: "Documents requested",
  },
  docs_received: { label: "Documents under review", tone: "info", switcherNote: "Under review" },
  under_review: { label: "Documents under review", tone: "info", switcherNote: "Under review" },
  connect_pending: { label: "Payouts not set up", tone: "warning", switcherNote: null },
  approved: { label: "Approved", tone: "success", switcherNote: null },
  restricted: { label: "Restricted", tone: "danger", switcherNote: "Restricted" },
  rejected: { label: "Not approved", tone: "danger", switcherNote: "Not approved" },
  archived: { label: "Closed", tone: "neutral", switcherNote: "Closed" },
};

export function organisationStatusView(status: LegalEntityStatus): OrganisationStatusView {
  return STATUS_VIEWS[status];
}
