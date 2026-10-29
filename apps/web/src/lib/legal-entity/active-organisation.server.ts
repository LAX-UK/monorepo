import "server-only";

import type { SessionUser } from "@/lib/data/contracts";
import { resolveActingContext } from "@/lib/legal-entity/acting-context.server";
import { resolveOrgModuleEnabledFromRequest } from "@/lib/legal-entity/org-module-host.server";
import type { EntityActor } from "@auction/domain";
import type { LegalEntitySummary } from "@auction/types";
import { notFound } from "next/navigation";

type Viewer = Pick<SessionUser, "role" | "staffRoles">;

/** The active organisation and the person's standing with it. */
export type ActiveOrganisationActor = {
  organisation: LegalEntitySummary;
  /** Support staff viewing as the client act as an impersonation, which is read-only. */
  actor: EntityActor;
};

/**
 * The organisation the person is using Bid as, with their standing, or `null` for their personal
 * account. Pages ask capabilities of `actor` (`entityActorCan`), never of the role alone.
 */
export async function resolveActiveOrganisationActor(
  viewer: Viewer,
): Promise<ActiveOrganisationActor | null> {
  if (!(await resolveOrgModuleEnabledFromRequest())) return null;
  const { acting, impersonation } = await resolveActingContext(viewer.role, viewer.staffRoles);
  if (acting?.kind !== "organisation") return null;
  return {
    organisation: acting,
    actor: { role: acting.role, isImpersonation: impersonation !== null },
  };
}

/**
 * The organisation the person is using Bid as, or `null` for their personal account. Pages such
 * as `/organisation` have no id in their address: they always show the active account.
 */
export async function resolveActiveOrganisation(
  viewer: Viewer,
): Promise<LegalEntitySummary | null> {
  return (await resolveActiveOrganisationActor(viewer))?.organisation ?? null;
}

/** The active organisation's id; a page that only exists for organisations is not found otherwise. */
export async function requireActiveOrganisationId(viewer: Viewer): Promise<string> {
  const organisation = await resolveActiveOrganisation(viewer);
  if (!organisation) notFound();
  return organisation.id;
}

/** The active organisation with the person's standing; not found for a personal account. */
export async function requireActiveOrganisationActor(
  viewer: Viewer,
): Promise<ActiveOrganisationActor> {
  const active = await resolveActiveOrganisationActor(viewer);
  if (!active) notFound();
  return active;
}
