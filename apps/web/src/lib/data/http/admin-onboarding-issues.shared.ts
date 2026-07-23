import { isIndexableObject } from "@/lib/data/http/object-guards";
import type { OnboardingTabId } from "@/lib/data/view-models/admin-onboarding-issues.vm";
import { z } from "zod";

export type AdminOnboardingIssuesApiTab =
  | "entities"
  | "artists"
  | "kyc"
  | "organizations"
  | "documents";

export type AdminOnboardingLegalEntityRow = {
  id: string;
  displayName: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  statusChangedAt: string | null;
};

export type AdminOnboardingArtistRow = {
  id: string;
  displayName: string;
  status: string;
  createdAt: string;
};

export type AdminOnboardingKycSessionRow = {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  provider: string;
  status: string;
  createdAt: string;
};

export type AdminOnboardingDocumentRow = {
  id: string;
  legalEntityId: string;
  entityDisplayName: string;
  uploadObjectId: string;
  uploadedAt: string;
};

export type AdminOnboardingStaleLeadRow = {
  id: string;
  displayName: string;
  createdAt: string;
};

export type AdminOnboardingIssueRow =
  | AdminOnboardingLegalEntityRow
  | AdminOnboardingArtistRow
  | AdminOnboardingKycSessionRow
  | AdminOnboardingDocumentRow
  | AdminOnboardingStaleLeadRow;

export type AdminOnboardingIssuesCrossSummary = {
  queueTotal: number;
  entities: number;
  artists: number;
  kyc: number;
  organizations: number;
  documents: number;
};

export type AdminOnboardingEntitiesLensSummary = {
  total: number;
  docsReceived: number;
  underReview: number;
};

export type AdminOnboardingArtistsLensSummary = {
  total: number;
};

export type AdminOnboardingKycLensSummary = {
  total: number;
  created: number;
  requiresInput: number;
  processing: number;
};

export type AdminOnboardingDocumentsLensSummary = {
  total: number;
};

export type AdminOnboardingOrganizationsLensSummary = {
  total: number;
};

export type AdminOnboardingIssuesLensSummary =
  | { tab: "entities"; summary: AdminOnboardingEntitiesLensSummary }
  | { tab: "artists"; summary: AdminOnboardingArtistsLensSummary }
  | { tab: "kyc"; summary: AdminOnboardingKycLensSummary }
  | { tab: "organizations"; summary: AdminOnboardingOrganizationsLensSummary }
  | { tab: "documents"; summary: AdminOnboardingDocumentsLensSummary };

export type AdminOnboardingIssuesPageParams = {
  tab: AdminOnboardingIssuesApiTab;
  limit: number;
  offset: number;
};

export type AdminOnboardingIssuesPage = {
  tab: AdminOnboardingIssuesApiTab;
  rows: AdminOnboardingIssueRow[];
  total: number;
  offset: number;
  limit: number;
  summary: AdminOnboardingIssuesCrossSummary;
  lensSummary: AdminOnboardingIssuesLensSummary;
  hasNextPage: boolean;
};

export const EMPTY_ADMIN_ONBOARDING_ISSUES_CROSS_SUMMARY: AdminOnboardingIssuesCrossSummary = {
  queueTotal: 0,
  entities: 0,
  artists: 0,
  kyc: 0,
  organizations: 0,
  documents: 0,
};

const entityRowSchema = z.object({
  id: z.coerce.string(),
  displayName: z.coerce.string(),
  status: z.coerce.string(),
  createdAt: z.coerce.string(),
  updatedAt: z.coerce.string(),
  statusChangedAt: z.union([z.null(), z.coerce.string()]),
});

const artistRowSchema = z.object({
  id: z.coerce.string(),
  displayName: z.coerce.string(),
  status: z.coerce.string(),
  createdAt: z.coerce.string(),
});

const kycRowSchema = z.object({
  id: z.coerce.string(),
  userId: z.coerce.string(),
  userName: z.union([z.null(), z.coerce.string()]),
  userEmail: z.union([z.null(), z.coerce.string()]),
  provider: z.coerce.string(),
  status: z.coerce.string(),
  createdAt: z.coerce.string(),
});

const documentRowSchema = z.object({
  id: z.coerce.string(),
  legalEntityId: z.coerce.string(),
  entityDisplayName: z.coerce.string(),
  uploadObjectId: z.coerce.string(),
  uploadedAt: z.coerce.string(),
});

const staleLeadRowSchema = z.object({
  id: z.coerce.string(),
  displayName: z.coerce.string(),
  createdAt: z.coerce.string(),
});

const crossSummarySchema = z.object({
  queueTotal: z.coerce.number().int().nonnegative(),
  entities: z.coerce.number().int().nonnegative(),
  artists: z.coerce.number().int().nonnegative(),
  kyc: z.coerce.number().int().nonnegative(),
  organizations: z.coerce.number().int().nonnegative(),
  documents: z.coerce.number().int().nonnegative(),
});

const entitiesLensSummarySchema = z.object({
  total: z.coerce.number().int().nonnegative(),
  docsReceived: z.coerce.number().int().nonnegative(),
  underReview: z.coerce.number().int().nonnegative(),
});

const artistsLensSummarySchema = z.object({
  total: z.coerce.number().int().nonnegative(),
});

const kycLensSummarySchema = z.object({
  total: z.coerce.number().int().nonnegative(),
  created: z.coerce.number().int().nonnegative(),
  requiresInput: z.coerce.number().int().nonnegative(),
  processing: z.coerce.number().int().nonnegative(),
});

const documentsLensSummarySchema = z.object({
  total: z.coerce.number().int().nonnegative(),
});

const organizationsLensSummarySchema = z.object({
  total: z.coerce.number().int().nonnegative(),
});

const apiTabSchema = z.enum(["entities", "artists", "kyc", "organizations", "documents"]);

function parseCrossSummary(value: unknown): AdminOnboardingIssuesCrossSummary {
  const parsed = crossSummarySchema.safeParse(value);
  if (!parsed.success) {
    throw new Error("Invalid onboarding issues cross summary in API response");
  }
  const summary = parsed.data;
  const bucketTotal =
    summary.entities + summary.artists + summary.kyc + summary.organizations + summary.documents;
  if (bucketTotal !== summary.queueTotal) {
    throw new Error("Onboarding issues cross summary buckets do not sum to queueTotal");
  }
  return summary;
}

function parseLensSummary(value: unknown): AdminOnboardingIssuesLensSummary {
  const envelope = isIndexableObject(value) ? value : {};
  const tab = apiTabSchema.parse(envelope.tab);
  switch (tab) {
    case "entities":
      return { tab, summary: entitiesLensSummarySchema.parse(envelope.summary) };
    case "artists":
      return { tab, summary: artistsLensSummarySchema.parse(envelope.summary) };
    case "kyc":
      return { tab, summary: kycLensSummarySchema.parse(envelope.summary) };
    case "organizations":
      return { tab, summary: organizationsLensSummarySchema.parse(envelope.summary) };
    case "documents":
      return { tab, summary: documentsLensSummarySchema.parse(envelope.summary) };
    default: {
      const _exhaustive: never = tab;
      throw new Error(`Unsupported onboarding lens tab: ${String(_exhaustive)}`);
    }
  }
}

function parseRowsForTab(
  tab: AdminOnboardingIssuesApiTab,
  rows: unknown[],
): AdminOnboardingIssueRow[] {
  switch (tab) {
    case "entities":
      return rows.map((row) => entityRowSchema.parse(row));
    case "artists":
      return rows.map((row) => artistRowSchema.parse(row));
    case "kyc":
      return rows.map((row) => kycRowSchema.parse(row));
    case "documents":
      return rows.map((row) => documentRowSchema.parse(row));
    case "organizations":
      return rows.map((row) => staleLeadRowSchema.parse(row));
    default: {
      const _exhaustive: never = tab;
      throw new Error(`Unsupported onboarding tab: ${String(_exhaustive)}`);
    }
  }
}

export function parseOnboardingIssueRow(
  tab: AdminOnboardingIssuesApiTab,
  row: unknown,
): AdminOnboardingIssueRow {
  const [parsed] = parseRowsForTab(tab, [row]);
  if (!parsed) {
    throw new Error("Invalid onboarding issue row in API response");
  }
  return parsed;
}

export function toApiOnboardingTab(tab: OnboardingTabId): AdminOnboardingIssuesApiTab {
  return tab === "orgs" ? "organizations" : tab;
}

export function fromApiOnboardingTab(tab: AdminOnboardingIssuesApiTab): OnboardingTabId {
  return tab === "organizations" ? "orgs" : tab;
}

export function buildAdminOnboardingIssuesSearchParams(
  params: AdminOnboardingIssuesPageParams,
): URLSearchParams {
  return new URLSearchParams({
    tab: params.tab,
    limit: String(params.limit),
    offset: String(params.offset),
  });
}

export function parseAdminOnboardingIssuesPageBody(
  body: unknown,
  params: AdminOnboardingIssuesPageParams,
): AdminOnboardingIssuesPage {
  const envelope = isIndexableObject(body) ? body : {};
  const meta = isIndexableObject(envelope.meta) ? envelope.meta : {};
  const tab = apiTabSchema.parse(meta.tab ?? params.tab);
  const rawRows = Array.isArray(envelope.data) ? envelope.data : [];
  const rows = parseRowsForTab(tab, rawRows);
  const summary = parseCrossSummary(meta.summary);
  const lensSummary = parseLensSummary(meta.lensSummary);
  if (lensSummary.tab !== tab) {
    throw new Error("Onboarding issues lensSummary tab does not match meta.tab");
  }
  const total = Number(meta.total);
  if (!Number.isFinite(total)) {
    throw new Error("Invalid onboarding issues list total in API response");
  }
  const limit = Number(meta.limit ?? params.limit);
  const offset = Number(meta.offset ?? params.offset);
  return {
    tab,
    rows,
    total,
    offset,
    limit,
    summary,
    lensSummary,
    hasNextPage: offset + rows.length < total,
  };
}
