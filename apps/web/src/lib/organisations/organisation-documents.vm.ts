import { type DocumentSlot, orgDocumentTitle } from "@/lib/legal-entity/org-document-requirements";
import {
  type OrganisationDocumentStateView,
  organisationDocumentStateView,
} from "@/lib/presenters/organisation-document-state";
import {
  type EntityActor,
  type OrganisationDocumentReviewStatus,
  type OrganisationDocumentState,
  type ReceivedOrganisationDocument,
  entityActorCan,
  organisationDocumentItems,
  organisationDocumentState,
  organisationDocumentsSendable,
} from "@auction/domain";
import type { LegalEntityStatus } from "@auction/types";

/** A document as the onboarding API returns it (its review status is a plain string there). */
export type OrganisationDocumentRecord = {
  id: string;
  kind: string;
  label: string | null;
  reviewStatus: string;
};

/** What to send for one row: the document's kind and, for "other" documents, its name. */
export type DocumentUploadTarget = { kind: string; label?: string };

export type OrganisationDocumentRowView = {
  key: string;
  title: string;
  state: OrganisationDocumentState;
  badge: OrganisationDocumentStateView;
  /** One plain line under the title, or `null` when the badge says it all. */
  hint: string | null;
  /** Offered only to people who can send documents now. */
  action: { label: "Upload" | "Replace"; target: DocumentUploadTarget } | null;
};

export type OrganisationDocumentsView = {
  intro: string;
  rows: OrganisationDocumentRowView[];
  /** Set when nothing was asked for and nothing was sent. */
  empty: { title: string; description: string } | null;
  /** Why someone who sends documents cannot right now; `null` for everyone else. */
  closedNote: string | null;
};

export type OrganisationDocumentsInput = {
  actor: EntityActor;
  status: LegalEntityStatus;
  organisationName: string;
  slots: readonly DocumentSlot[];
  received: readonly OrganisationDocumentRecord[];
  /** When the organisation's check was approved, for "Checked on 9 May 2026". */
  checkedOn?: Date | string | null;
};

const REVIEW_STATUSES: ReadonlySet<string> = new Set(["pending", "approved", "rejected"]);

/** An unknown review status is treated as not yet checked, never shown raw. */
function reviewStatusOf(value: string): OrganisationDocumentReviewStatus {
  return REVIEW_STATUSES.has(value) ? (value as OrganisationDocumentReviewStatus) : "pending";
}

/** The badge for one document already sent, while the organisation is in `status`. */
export function receivedDocumentBadge(
  reviewStatus: string,
  status: LegalEntityStatus,
): OrganisationDocumentStateView {
  return organisationDocumentStateView(
    organisationDocumentState({ reviewStatus: reviewStatusOf(reviewStatus) }, status),
  );
}

const ACTION_BY_STATE: Record<OrganisationDocumentState, "Upload" | "Replace" | null> = {
  requested: "Upload",
  received: "Replace",
  in_review: null,
  accepted: null,
  needs_replacing: "Replace",
};

const CHECK_DATE = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** "Checked on 9 May 2026", or `null` without a usable date. */
export function checkedOnLine(checkedOn: Date | string | null | undefined): string | null {
  if (!checkedOn) return null;
  const date = checkedOn instanceof Date ? checkedOn : new Date(checkedOn);
  return Number.isNaN(date.getTime()) ? null : `Checked on ${CHECK_DATE.format(date)}`;
}

function hintFor(
  state: OrganisationDocumentState,
  canSend: boolean,
  checked: string | null,
  received: boolean,
): string | null {
  // Accepted without a copy on file: the organisation's check is what accepted it.
  if (state === "accepted" && !received) return checked;
  if (state === "needs_replacing") {
    return canSend
      ? "We couldn't accept this copy. Send a clear, current one."
      : "We couldn't accept this copy. Our team will be in touch about a new one.";
  }
  return null;
}

function uploadTarget(kind: string, label: string | null | undefined, title: string) {
  // "Other" documents are told apart by name, so one always travels with them.
  if (kind === "other") return { kind, label: label?.trim() || title };
  return { kind };
}

/**
 * The Documents tab for one member: every document asked for, what was received and where it
 * is. Upload and Replace appear only while the member's role sends documents and the
 * organisation is waiting for them; everyone else reads the same list.
 */
export function buildOrganisationDocumentsView(
  input: OrganisationDocumentsInput,
): OrganisationDocumentsView {
  const { actor, status, organisationName, slots } = input;
  const canSend = organisationDocumentsSendable(actor, status);
  const received: ReceivedOrganisationDocument[] = input.received.map((doc) => ({
    id: doc.id,
    kind: doc.kind,
    label: doc.label,
    reviewStatus: reviewStatusOf(doc.reviewStatus),
  }));
  const checked = status === "approved" ? checkedOnLine(input.checkedOn) : null;
  const items = organisationDocumentItems(slots, received, status);
  const rows = items.map((item, index): OrganisationDocumentRowView => {
    const slot = slots[index];
    const title = slot?.title ?? orgDocumentTitle(item.requested.kind, item.requested.label);
    const actionLabel = canSend ? ACTION_BY_STATE[item.state] : null;
    return {
      key: slot ? `slot-${index}` : `doc-${item.received?.id ?? index}`,
      title,
      state: item.state,
      badge: organisationDocumentStateView(item.state),
      hint: hintFor(item.state, canSend, checked, item.received !== null),
      action: actionLabel
        ? {
            label: actionLabel,
            target: uploadTarget(item.requested.kind, item.requested.label, title),
          }
        : null,
    };
  });
  const sendsDocuments = entityActorCan(actor, "entity.documents.manage");
  return {
    intro: `What we asked ${organisationName} for, and where each document is.`,
    rows,
    empty:
      rows.length === 0
        ? {
            title: "No documents needed",
            description: `We haven't asked ${organisationName} for any documents.`,
          }
        : null,
    closedNote:
      sendsDocuments && !canSend && rows.length > 0
        ? "You can send documents here again if we ask for more."
        : null,
  };
}
