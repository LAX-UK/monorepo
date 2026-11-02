import type { LegalEntityStatus } from "@auction/types";
import { type EntityActor, entityActorCan } from "./entity-capabilities.js";
import { organisationStateAllows } from "./organisation-state-policy.js";

/**
 * The documents LAX checks before an organisation can trade: what was asked for, what was
 * received and where each one is. The words live in the web presenter.
 */
export type OrganisationDocumentState =
  /** Asked for, nothing sent yet. */
  | "requested"
  /** Sent; LAX has not started checking it. */
  | "received"
  /** LAX is checking it. */
  | "in_review"
  | "accepted"
  /** LAX could not accept it, so a new copy is needed. */
  | "needs_replacing";

export type OrganisationDocumentReviewStatus = "pending" | "approved" | "rejected";

/** One document LAX asks for. `label` tells apart several "other" documents. */
export type RequestedOrganisationDocument = { kind: string; label?: string | null };

/** One document the organisation has sent. */
export type ReceivedOrganisationDocument = {
  id: string;
  kind: string;
  label: string | null;
  reviewStatus: OrganisationDocumentReviewStatus;
};

export type OrganisationDocumentItem = {
  requested: RequestedOrganisationDocument;
  /** The latest copy received for it, or `null` while nothing has been sent. */
  received: ReceivedOrganisationDocument | null;
  state: OrganisationDocumentState;
};

/** While the organisation is with LAX for its checks, a document sent is a document in review. */
const UNDER_CHECK: ReadonlySet<LegalEntityStatus> = new Set(["docs_received", "under_review"]);

const STATE_BY_REVIEW: Record<OrganisationDocumentReviewStatus, OrganisationDocumentState> = {
  pending: "received",
  approved: "accepted",
  rejected: "needs_replacing",
};

/**
 * Where one requested document is, from what was received and the organisation's status. An
 * approved organisation has passed its check, so nothing is outstanding: a document LAX asked for
 * and holds no copy of is accepted too, not "not sent yet".
 */
export function organisationDocumentState(
  received: Pick<ReceivedOrganisationDocument, "reviewStatus"> | null,
  status: LegalEntityStatus,
): OrganisationDocumentState {
  if (!received) return status === "approved" ? "accepted" : "requested";
  const state = STATE_BY_REVIEW[received.reviewStatus];
  return state === "received" && UNDER_CHECK.has(status) ? "in_review" : state;
}

function matches(requested: RequestedOrganisationDocument, doc: ReceivedOrganisationDocument) {
  if (doc.kind !== requested.kind) return false;
  return requested.label ? doc.label === requested.label : true;
}

/**
 * Every requested document with the copy received for it, in the order LAX asks for them,
 * followed by anything else the organisation sent. When several copies match, the last one
 * received counts (a replacement follows the copy it replaces).
 */
export function organisationDocumentItems(
  requested: readonly RequestedOrganisationDocument[],
  received: readonly ReceivedOrganisationDocument[],
  status: LegalEntityStatus,
): OrganisationDocumentItem[] {
  const used = new Set<string>();
  const items = requested.map((want) => {
    const copy = received.filter((doc) => matches(want, doc)).at(-1) ?? null;
    if (copy) for (const doc of received) if (matches(want, doc)) used.add(doc.id);
    return { requested: want, received: copy, state: organisationDocumentState(copy, status) };
  });
  const extra = received
    .filter((doc) => !used.has(doc.id))
    .map((doc) => ({
      requested: { kind: doc.kind, label: doc.label },
      received: doc,
      state: organisationDocumentState(doc, status),
    }));
  return [...items, ...extra];
}

/**
 * Whether this member may send documents now: their role sends them (owners and admins) and
 * the organisation is waiting for them. The server applies the same two rules.
 */
export function organisationDocumentsSendable(
  actor: EntityActor,
  status: LegalEntityStatus,
): boolean {
  return (
    entityActorCan(actor, "entity.documents.manage") &&
    organisationStateAllows(status, "send_documents")
  );
}
