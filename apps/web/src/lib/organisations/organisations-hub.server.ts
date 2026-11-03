import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { getOrgOnboardingResumeHrefForEntity } from "@/lib/data/http/org-onboarding.server";
import { isOrgOnboardingInProgress } from "@/lib/legal-entity/org-onboarding-in-progress";
import { createOrganisationHubGateway } from "@/lib/legal-entity/organisation-hub.gateway.server";
import type { PendingInvitationRow } from "@/lib/legal-entity/pending-invitations.gateway.server";
import { getConnectGapState } from "@auction/connect";
import type { LegalEntitySummary } from "@auction/types";
import type {
  InvitationSource,
  OrganisationSource,
  PersonalSource,
} from "./organisation-accounts.vm";

export type OrganisationsHub =
  | { ok: false }
  | {
      ok: true;
      personal: PersonalSource | null;
      organisations: OrganisationSource[];
      invitations: InvitationSource[];
    };

async function readData<T>(path: string): Promise<T[] | null> {
  const res = await authedServerFetch(path, { cache: "no-store" });
  if (!res.ok) return null;
  const body = (await res.json()) as { data?: T[] };
  return body.data ?? [];
}

async function organisationSource(
  summary: LegalEntitySummary,
  gateway: ReturnType<typeof createOrganisationHubGateway>,
): Promise<OrganisationSource> {
  const [detail, resumeHref] = await Promise.all([
    gateway.getEntityDetail(summary.id),
    isOrgOnboardingInProgress(summary.status)
      ? getOrgOnboardingResumeHrefForEntity(summary.id)
      : null,
  ]);
  return {
    id: summary.id,
    displayName: summary.displayName,
    subkind: summary.subkind,
    status: summary.status,
    role: summary.role,
    resumeHref,
    payoutDetailsNeeded: detail ? getConnectGapState(detail).missing.length > 0 : false,
  };
}

/**
 * What "Your organisations" lists: the person's own account, each organisation they belong to
 * and the invitations waiting for an answer. The invitations only add to the page, so a failed
 * read of them leaves the accounts; a failed read of the accounts fails the page.
 */
export async function loadOrganisationsHub(): Promise<OrganisationsHub> {
  try {
    const memberships = await readData<LegalEntitySummary>("/legal-entities/me");
    if (!memberships) return { ok: false };
    const invitations = await readData<PendingInvitationRow>("/legal-entities/invitations/mine");
    const gateway = createOrganisationHubGateway();
    const personal = memberships.find((m) => m.kind === "individual");
    const organisations = await Promise.all(
      memberships
        .filter((m) => m.kind === "organisation")
        .map((m) => organisationSource(m, gateway)),
    );
    return {
      ok: true,
      personal: personal
        ? { id: personal.id, displayName: personal.displayName, subkind: personal.subkind }
        : null,
      organisations,
      invitations: invitations ?? [],
    };
  } catch {
    return { ok: false };
  }
}
