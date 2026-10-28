import "server-only";

import type { SessionUser } from "@/lib/data/contracts";
import { resolveActingContext } from "@/lib/legal-entity/acting-context.server";
import { resolveOrgModuleEnabledFromRequest } from "@/lib/legal-entity/org-module-host.server";
import type { LegalEntitySummary } from "@auction/types";
import { notFound } from "next/navigation";

type Viewer = Pick<SessionUser, "role" | "staffRoles">;

/**
 * The organisation the person is using Bid as, or `null` for their personal account. Pages such
 * as `/organisation` have no id in their address: they always show the active account.
 */
export async function resolveActiveOrganisation(
  viewer: Viewer,
): Promise<LegalEntitySummary | null> {
  if (!(await resolveOrgModuleEnabledFromRequest())) return null;
  const { acting } = await resolveActingContext(viewer.role, viewer.staffRoles);
  return acting?.kind === "organisation" ? acting : null;
}

/** The active organisation's id; a page that only exists for organisations is not found otherwise. */
export async function requireActiveOrganisationId(viewer: Viewer): Promise<string> {
  const organisation = await resolveActiveOrganisation(viewer);
  if (!organisation) notFound();
  return organisation.id;
}
