import "server-only";

import type { SessionUser } from "@/lib/data/contracts";
import { lookupActingContext } from "@/lib/legal-entity/acting-context.server";
import { loadOrganisationDocuments } from "@/lib/organisations/organisation-documents.server";
import {
  buildOrganisationDocumentsView,
  latestUploadedAt,
} from "@/lib/organisations/organisation-documents.vm";
import {
  type OrganisationRecoveryView,
  buildOrganisationRecoveryView,
  recoveryShowsDocuments,
} from "@/lib/organisations/organisation-recovery.vm";
import { type EntityActor, entityActorCan, organisationRecoveryKind } from "@auction/domain";
import type { LegalEntitySummary } from "@auction/types";

type Viewer = Pick<SessionUser, "role" | "staffRoles" | "kycStatus">;

/** A read that fails leaves its part out; it never blanks the page the recovery sits on. */
async function settled<T>(read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read();
  } catch {
    return fallback;
  }
}

type DocumentsRead = {
  view: ReturnType<typeof buildOrganisationDocumentsView> | null;
  latestSentAt: Date | null;
};

/** The documents asked for and the day the latest arrived, for the states that wait on them. */
async function readDocuments(
  organisation: Pick<LegalEntitySummary, "id" | "status" | "displayName">,
  actor: EntityActor,
): Promise<DocumentsRead> {
  const none: DocumentsRead = { view: null, latestSentAt: null };
  if (!recoveryShowsDocuments(organisation.status)) return none;
  // Whoever reads the Documents tab reads the same list here; other members see no checklist.
  if (!entityActorCan(actor, "entity.profile.read")) return none;
  const loaded = await settled(() => loadOrganisationDocuments(organisation.id), null);
  if (!loaded?.ok) return none;
  return {
    view: buildOrganisationDocumentsView({
      actor,
      status: organisation.status,
      organisationName: organisation.displayName,
      slots: loaded.slots,
      received: loaded.received,
    }),
    latestSentAt: latestUploadedAt(loaded.received),
  };
}

/**
 * The recovery for the active organisation, for Home and the Organisation page: what is open and
 * paused, the documents asked for, where the check has got to and the way to keep buying as the
 * person themselves. `null` when the organisation's state needs no recovery.
 */
export async function loadOrganisationRecovery(input: {
  viewer: Viewer;
  organisation: Pick<LegalEntitySummary, "id" | "status" | "displayName">;
  actor: EntityActor;
}): Promise<OrganisationRecoveryView | null> {
  const { organisation, actor, viewer } = input;
  if (!organisationRecoveryKind(organisation.status)) return null;
  const [documents, acting] = await Promise.all([
    readDocuments(organisation, actor),
    settled(() => lookupActingContext(viewer.role, viewer.staffRoles), null),
  ]);
  const personal = (acting?.ok ? acting.context.memberships : []).find(
    (m) => m.kind === "individual",
  );
  return buildOrganisationRecoveryView({
    status: organisation.status,
    documents: documents.view,
    documentsReceivedAt: documents.latestSentAt,
    now: new Date(),
    personalAccountId: personal?.id ?? null,
    // The personal account bids once its identity check is clear.
    personalCanBid: viewer.kycStatus === "approved",
    impersonating: actor.isImpersonation === true,
  });
}
