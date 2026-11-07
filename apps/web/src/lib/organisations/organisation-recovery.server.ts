import "server-only";

import type { SessionUser } from "@/lib/data/contracts";
import { lookupActingContext } from "@/lib/legal-entity/acting-context.server";
import { createPerOrgGateway } from "@/lib/legal-entity/per-org.gateway.server";
import { loadOrganisationDocuments } from "@/lib/organisations/organisation-documents.server";
import { buildOrganisationDocumentsView } from "@/lib/organisations/organisation-documents.vm";
import {
  type OrganisationRecoveryView,
  buildOrganisationRecoveryView,
  recoveryShowsDocuments,
} from "@/lib/organisations/organisation-recovery.vm";
import { type EntityActor, entityActorCan, organisationRecoveryKind } from "@auction/domain";
import type { LegalEntitySummary } from "@auction/types";

type Viewer = Pick<SessionUser, "role" | "staffRoles">;

/** A read that fails leaves its part out; it never blanks the page the recovery sits on. */
async function settled<T>(read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read();
  } catch {
    return fallback;
  }
}

async function readDocumentsView(
  organisation: Pick<LegalEntitySummary, "id" | "status" | "displayName">,
  actor: EntityActor,
) {
  // Whoever reads the Documents tab reads the same list here; other members see no checklist.
  if (
    !(recoveryShowsDocuments(organisation.status) && entityActorCan(actor, "entity.profile.read"))
  ) {
    return null;
  }
  const loaded = await settled(() => loadOrganisationDocuments(organisation.id), null);
  if (!loaded?.ok) return null;
  return buildOrganisationDocumentsView({
    actor,
    status: organisation.status,
    organisationName: organisation.displayName,
    slots: loaded.slots,
    received: loaded.received,
  });
}

/** The date the status last changed, read only when the recovery says how far the check has got. */
async function readStatusChangedAt(
  organisationId: string,
  known: Date | string | null | undefined,
) {
  if (known) return known;
  const context = await settled(() => createPerOrgGateway().getContext(organisationId), null);
  return context?.entity?.statusChangedAt ?? null;
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
  /** When the layout already read it; Home leaves it to be read when needed. */
  statusChangedAt?: Date | string | null | undefined;
}): Promise<OrganisationRecoveryView | null> {
  const { organisation, actor, viewer } = input;
  if (!organisationRecoveryKind(organisation.status)) return null;
  const needsDate =
    organisation.status === "docs_received" || organisation.status === "under_review";
  const [documents, statusChangedAt, acting] = await Promise.all([
    readDocumentsView(organisation, actor),
    needsDate ? readStatusChangedAt(organisation.id, input.statusChangedAt) : null,
    settled(() => lookupActingContext(viewer.role, viewer.staffRoles), null),
  ]);
  const personal =
    (acting?.ok ? acting.context.memberships : []).find((m) => m.kind === "individual") ?? null;
  return buildOrganisationRecoveryView({
    status: organisation.status,
    documents,
    statusChangedAt,
    personalAccountId: personal?.id ?? null,
    impersonating: actor.isImpersonation === true,
  });
}
