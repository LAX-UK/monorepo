import "server-only";

import {
  type AdminOnboardingIssueRow,
  type AdminOnboardingIssuesApiTab,
  type AdminOnboardingIssuesPage,
  type AdminOnboardingIssuesPageParams,
  buildAdminOnboardingIssuesSearchParams,
  parseAdminOnboardingIssuesPageBody,
  parseOnboardingIssueRow,
} from "@/lib/data/http/admin-onboarding-issues.shared";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readJsonBody } from "@/lib/data/http/envelope";
import { isIndexableObject } from "@/lib/data/http/object-guards";
import { normalizeApiErrorMessage } from "@auction/validators";

export type {
  AdminOnboardingArtistRow,
  AdminOnboardingDocumentRow,
  AdminOnboardingIssueRow,
  AdminOnboardingIssuesApiTab,
  AdminOnboardingIssuesCrossSummary,
  AdminOnboardingIssuesLensSummary,
  AdminOnboardingIssuesPage,
  AdminOnboardingIssuesPageParams,
  AdminOnboardingKycSessionRow,
  AdminOnboardingLegalEntityRow,
  AdminOnboardingStaleLeadRow,
} from "@/lib/data/http/admin-onboarding-issues.shared";

function readApiError(body: unknown, fallback: string): string {
  const error = isIndexableObject(body) ? body.error : undefined;
  return normalizeApiErrorMessage(error, fallback);
}

export async function getAdminOnboardingIssuesPage(
  params: AdminOnboardingIssuesPageParams,
): Promise<AdminOnboardingIssuesPage> {
  const qs = buildAdminOnboardingIssuesSearchParams(params);
  const res = await authedServerFetch(`/admin/onboarding-issues?${qs.toString()}`, {
    cache: "no-store",
  });
  if (res.status === 403 || res.status === 401) {
    throw new Error("forbidden");
  }
  if (!res.ok) {
    const body = await readJsonBody(res).catch(() => ({}));
    throw new Error(readApiError(body, "Could not load onboarding issues"));
  }
  const body = await readJsonBody(res);
  return parseAdminOnboardingIssuesPageBody(body, params);
}

/** Resolve a lens row by id without scanning paginated list pages. */
export async function findAdminOnboardingIssueInLens(
  tab: AdminOnboardingIssuesApiTab,
  itemId: string,
  _opts?: { pageSize?: number; knownTotal?: number },
): Promise<AdminOnboardingIssueRow | null> {
  const qs = new URLSearchParams({ tab, id: itemId });
  const res = await authedServerFetch(`/admin/onboarding-issues/selected?${qs.toString()}`, {
    cache: "no-store",
  });
  if (res.status === 403 || res.status === 401) {
    throw new Error("forbidden");
  }
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    const body = await readJsonBody(res).catch(() => ({}));
    throw new Error(readApiError(body, "Could not load onboarding issue"));
  }
  const body = await readJsonBody(res);
  const data = isIndexableObject(body) ? body.data : null;
  if (data == null) return null;
  return parseOnboardingIssueRow(tab, data);
}
