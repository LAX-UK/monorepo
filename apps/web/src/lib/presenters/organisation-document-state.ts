import type { OrganisationDocumentState } from "@auction/domain";
import type { StatusBadgeProps } from "@auction/ui/components/status-badge";

export type OrganisationDocumentStateView = {
  /** The badge words. */
  label: string;
  tone: NonNullable<StatusBadgeProps["tone"]>;
};

/**
 * The words for each document state. Every state has an entry, so a new one fails to compile
 * until it has words; nothing falls back to a raw review status.
 */
const DOCUMENT_STATE_VIEW: Record<OrganisationDocumentState, OrganisationDocumentStateView> = {
  requested: { label: "Not sent yet", tone: "warning" },
  received: { label: "Received", tone: "neutral" },
  in_review: { label: "Being checked", tone: "info" },
  accepted: { label: "Accepted", tone: "success" },
  needs_replacing: { label: "Needs replacing", tone: "danger" },
};

export function organisationDocumentStateView(
  state: OrganisationDocumentState,
): OrganisationDocumentStateView {
  return DOCUMENT_STATE_VIEW[state];
}
