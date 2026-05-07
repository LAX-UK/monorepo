import "server-only";

import type { ListLotsParams } from "@/lib/data/contracts";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { buildLotListQuery } from "@/lib/data/http/lots.server";
import { parseLot, parseSale } from "@/lib/data/http/parse";
import type {
  AdminCategory,
  ArtistProfile,
  LegalEntity,
  LegalEntityStatus,
  Lot,
  PayoutStatus,
  Sale,
} from "@auction/types";
import {
  legalEntityKinds,
  legalEntityStatuses,
  legalEntitySubkinds,
} from "@auction/types";
import type { PaymentStatus } from "@auction/types";

export type AdminPaymentRow = {
  id: string;
  lotId: string;
  buyerId: string;
  sellerId: string;
  amount: string;
  platformFee: string;
  status: PaymentStatus;
  createdAt: Date;
  xeroInvoiceNumber: string | null;
  xeroOnlineInvoiceUrl: string | null;
  xeroSyncStatus: "pending_sync" | "synced" | "error" | null;
  xeroLastError: string | null;
};

export type AdminPayoutRow = {
  id: string;
  legalEntityId: string;
  periodStart: string;
  periodEnd: string;
  grossAmount: string;
  platformFee: string;
  stripeFee: string;
  netAmount: string;
  currency: string;
  status: PayoutStatus;
  stripeTransferId: string | null;
  xeroBillId: string | null;
  failureReason: string | null;
  processedAt: string | null;
  statementUrl: string | null;
  statementGenerationError: string | null;
  createdAt: string;
};

function parseAdminCategory(raw: unknown): AdminCategory {
  const o = raw as Record<string, unknown>;
  const usageRaw = (o.usage ?? {}) as Record<string, unknown>;
  const lots = Number(usageRaw.lots ?? 0);
  const sales = Number(usageRaw.sales ?? 0);
  const submissions = Number(usageRaw.submissions ?? 0);
  return {
    id: String(o.id ?? ""),
    name: String(o.name ?? ""),
    slug: String(o.slug ?? ""),
    description: o.description == null ? null : String(o.description),
    archived: Boolean(o.archived ?? false),
    sortOrder: Number(o.sortOrder ?? 0),
    parentId: o.parentId == null ? null : String(o.parentId),
    usage: {
      lots,
      sales,
      submissions,
      total: Number(usageRaw.total ?? lots + sales + submissions),
    },
  };
}

function parseArtistProfile(raw: unknown): ArtistProfile {
  const o = raw as Record<string, unknown>;
  return {
    id: String(o.id ?? ""),
    displayName: String(o.displayName ?? ""),
    slug: String(o.slug ?? ""),
    portraitUrl: o.portraitUrl == null ? null : String(o.portraitUrl),
    heroImageUrl: o.heroImageUrl == null ? null : String(o.heroImageUrl),
    shortBio: o.shortBio == null ? null : String(o.shortBio),
    longBio: o.longBio == null ? null : String(o.longBio),
    statement: o.statement == null ? null : String(o.statement),
    nationality: o.nationality == null ? null : String(o.nationality),
    location: o.location == null ? null : String(o.location),
    birthYear: o.birthYear == null ? null : String(o.birthYear),
    deathYear: o.deathYear == null ? null : String(o.deathYear),
    websiteUrl: o.websiteUrl == null ? null : String(o.websiteUrl),
    socialLinks:
      o.socialLinks && typeof o.socialLinks === "object"
        ? (o.socialLinks as Record<string, string>)
        : {},
    featured: Boolean(o.featured),
    verified: Boolean(o.verified),
    archived: Boolean(o.archived),
    ownerUserId: o.ownerUserId == null ? null : String(o.ownerUserId),
    createdAt: new Date(String(o.createdAt ?? "")),
    updatedAt: new Date(String(o.updatedAt ?? "")),
  };
}

function isPaymentStatus(s: string): s is PaymentStatus {
  return s === "pending" || s === "authorized" || s === "captured" || s === "refunded";
}

function isPayoutStatus(s: unknown): s is PayoutStatus {
  return (
    s === "scheduled" || s === "in_transit" || s === "paid" || s === "failed" || s === "reversed"
  );
}

function isXeroSyncStatus(s: unknown): s is NonNullable<AdminPaymentRow["xeroSyncStatus"]> {
  return s === "pending_sync" || s === "synced" || s === "error";
}

function parseAdminPaymentRow(raw: unknown): AdminPaymentRow {
  const o = raw as Record<string, unknown>;
  const status = typeof o.status === "string" && isPaymentStatus(o.status) ? o.status : "pending";
  const lotId = o.lotId != null ? String(o.lotId) : String(o.auctionId ?? "");
  const xeroSync = o.xeroSyncStatus;
  return {
    id: String(o.id ?? ""),
    lotId,
    buyerId: String(o.buyerId ?? ""),
    sellerId: String(o.sellerId ?? ""),
    amount: String(o.amount ?? "0"),
    platformFee: String(o.platformFee ?? "0"),
    status,
    createdAt: o.createdAt instanceof Date ? o.createdAt : new Date(String(o.createdAt ?? "")),
    xeroInvoiceNumber: o.xeroInvoiceNumber != null ? String(o.xeroInvoiceNumber) : null,
    xeroOnlineInvoiceUrl: o.xeroOnlineInvoiceUrl != null ? String(o.xeroOnlineInvoiceUrl) : null,
    xeroSyncStatus: isXeroSyncStatus(xeroSync) ? xeroSync : null,
    xeroLastError: o.xeroLastError != null ? String(o.xeroLastError) : null,
  };
}

function parseAdminPayoutRow(raw: unknown): AdminPayoutRow {
  const o = raw as Record<string, unknown>;
  return {
    id: String(o.id ?? ""),
    legalEntityId: String(o.legalEntityId ?? ""),
    periodStart: String(o.periodStart ?? ""),
    periodEnd: String(o.periodEnd ?? ""),
    grossAmount: String(o.grossAmount ?? "0.00"),
    platformFee: String(o.platformFee ?? "0.00"),
    stripeFee: String(o.stripeFee ?? "0.00"),
    netAmount: String(o.netAmount ?? "0.00"),
    currency: String(o.currency ?? "GBP"),
    status: isPayoutStatus(o.status) ? o.status : "scheduled",
    stripeTransferId: o.stripeTransferId == null ? null : String(o.stripeTransferId),
    xeroBillId: o.xeroBillId == null ? null : String(o.xeroBillId),
    failureReason: o.failureReason == null ? null : String(o.failureReason),
    processedAt: o.processedAt == null ? null : String(o.processedAt),
    statementUrl: o.statementUrl == null ? null : String(o.statementUrl),
    statementGenerationError:
      o.statementGenerationError == null ? null : String(o.statementGenerationError),
    createdAt: String(o.createdAt ?? ""),
  };
}

export async function getAdminLotList(params: ListLotsParams = {}): Promise<Lot[]> {
  const qs = new URLSearchParams(
    buildLotListQuery({ limit: params.limit ?? 100, offset: params.offset ?? 0, ...params }),
  );
  const res = await authedServerFetch(`/lots?${qs.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to load lots: ${res.status}`);
  }
  const body = (await res.json()) as { data: unknown[] };
  return body.data.map(parseLot);
}

export async function getAdminCategoryList(
  params: {
    includeArchived?: boolean;
  } = {},
): Promise<AdminCategory[]> {
  const qs = new URLSearchParams();
  if (params.includeArchived) qs.set("includeArchived", "true");
  const res = await authedServerFetch(`/admin/categories${qs.size ? `?${qs.toString()}` : ""}`);
  if (!res.ok) throw new Error(`Failed to load categories: ${res.status}`);
  const body = (await res.json()) as { data: unknown[] };
  return body.data.map(parseAdminCategory);
}

export async function getAdminCategoryById(id: string): Promise<AdminCategory | null> {
  const res = await authedServerFetch(`/admin/categories/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load category: ${res.status}`);
  const body = (await res.json()) as { data: unknown };
  return parseAdminCategory(body.data);
}

export async function getAdminArtistList(
  params: {
    includeArchived?: boolean;
    q?: string;
  } = {},
): Promise<ArtistProfile[]> {
  const qs = new URLSearchParams();
  if (params.includeArchived) qs.set("includeArchived", "true");
  if (params.q) qs.set("q", params.q);
  const query = qs.toString();
  const res = await authedServerFetch(`/admin/artists${query ? `?${query}` : ""}`);
  if (!res.ok) throw new Error(`Failed to load artists: ${res.status}`);
  const body = (await res.json()) as { data: unknown[] };
  return body.data.map(parseArtistProfile);
}

export async function getAdminArtistById(id: string): Promise<ArtistProfile | null> {
  const res = await authedServerFetch(`/admin/artists/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load artist: ${res.status}`);
  const body = (await res.json()) as { data: unknown };
  return parseArtistProfile(body.data);
}

export type AdminSaleListRow = { sale: Sale; lots: Lot[] };

export async function getAdminSalesList(
  params: {
    status?: Sale["status"];
    limit?: number;
    offset?: number;
  } = {},
): Promise<AdminSaleListRow[]> {
  const qs = new URLSearchParams();
  qs.set("limit", String(params.limit ?? 50));
  qs.set("offset", String(params.offset ?? 0));
  if (params.status) qs.set("status", params.status);
  const res = await authedServerFetch(`/sales?${qs.toString()}`);
  if (!res.ok) throw new Error(`Failed to load sales: ${res.status}`);
  const body = (await res.json()) as { data: { sale: unknown; lots: unknown[] }[] };
  return body.data.map((row) => ({
    sale: parseSale(row.sale),
    lots: row.lots.map(parseLot),
  }));
}

export async function getAdminSaleById(id: string): Promise<AdminSaleListRow | null> {
  const res = await authedServerFetch(`/sales/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load sale: ${res.status}`);
  const body = (await res.json()) as { data: { sale: unknown; lots: unknown[] } };
  return {
    sale: parseSale(body.data.sale),
    lots: body.data.lots.map(parseLot),
  };
}

export async function getAdminLotById(id: string): Promise<Lot | null> {
  const res = await authedServerFetch(`/lots/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to load lot: ${res.status}`);
  }
  const body = (await res.json()) as { data: unknown };
  return parseLot(body.data);
}

export async function getAdminPaymentList(): Promise<AdminPaymentRow[]> {
  const res = await authedServerFetch("/payments");
  if (!res.ok) {
    throw new Error(`Failed to load payments: ${res.status}`);
  }
  const body = (await res.json()) as { data: unknown[] };
  return body.data.map(parseAdminPaymentRow);
}

export async function getAdminPayoutList(
  params: {
    legalEntityId?: string;
    status?: PayoutStatus;
    limit?: number;
    offset?: number;
  } = {},
): Promise<AdminPayoutRow[]> {
  const qs = new URLSearchParams();
  if (params.legalEntityId) qs.set("legalEntityId", params.legalEntityId);
  if (params.status) qs.set("status", params.status);
  qs.set("limit", String(params.limit ?? 50));
  qs.set("offset", String(params.offset ?? 0));
  const res = await authedServerFetch(`/admin/payouts?${qs.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to load payouts: ${res.status}`);
  }
  const body = (await res.json()) as { data: unknown[] };
  return body.data.map(parseAdminPayoutRow);
}

export type AdminXeroIntegrationStatus = {
  connected: boolean;
  tenantId: string | null;
  tenantName: string | null;
  expiresAt: string | null;
  oauthConfigured: boolean;
  /** Optional explicit token expiry (mockup label "Token expiry"); falls back to `expiresAt`. */
  tokenExpiresAt?: string;
  /** Optional fully-qualified webhook URL; the page falls back to env composition when absent. */
  webhookUrl?: string;
};

export async function getAdminXeroIntegrationStatus(): Promise<AdminXeroIntegrationStatus> {
  const res = await authedServerFetch("/admin/integrations/xero/status");
  if (!res.ok) {
    throw new Error(`Failed to load Xero status: ${res.status}`);
  }
  const body = (await res.json()) as { data: AdminXeroIntegrationStatus };
  return body.data;
}

export type AdminAnalyticsPayload = {
  activeLots: number;
  lotCompletedSeries: { date: string; count: number }[];
  conversion: { ended: number; withWinner: number };
  revenueSeries: { date: string; total: string }[];
  averageOrderValue: string | null;
  registrationSeries: { date: string; count: number }[];
  totalUsers: number;
  sparklines?: {
    revenue: readonly number[];
    lotCompleted: readonly number[];
    registrations: readonly number[];
  };
};

export type AdminTodayMetricsPayload = {
  liveLots: number;
  endingWithinHour: number;
  draftLots: number;
  pendingSubmissions: number;
  stalePendingPayments: number;
  revenueToday: string;
};

export type AdminFinanceIssuesPayload = {
  failedPayoutCount: number;
  legalEntitiesWithStripeConnectRequirementsCount: number;
  entitiesPendingReviewCount: number;
  artistsPendingApprovalCount: number;
  staleIdentitySessionsCount: number;
  documentsAwaitingReviewCount: number;
};

export async function getAdminFinanceIssues(): Promise<AdminFinanceIssuesPayload> {
  const res = await authedServerFetch("/admin/metrics/finance-issues");
  if (!res.ok) throw new Error(`Failed to load finance issue metrics: ${res.status}`);
  const body = (await res.json()) as { data: AdminFinanceIssuesPayload };
  return body.data;
}

export type AdminOnboardingIssuesPayload = {
  entitiesPendingReview: { id: string; displayName: string; status: string }[];
  artistsPendingApproval: { id: string; displayName: string; status: string }[];
  staleIdentitySessions: { id: string; userId: string; status: string; createdAt: string }[];
  documentsAwaitingReview: {
    id: string;
    legalEntityId: string;
    entityDisplayName: string;
    uploadObjectId: string;
    uploadedAt: string;
  }[];
};

export async function getAdminOnboardingIssues(): Promise<AdminOnboardingIssuesPayload> {
  const res = await authedServerFetch("/admin/onboarding-issues");
  if (!res.ok) throw new Error(`Failed to load onboarding issues: ${res.status}`);
  const body = (await res.json()) as { data: AdminOnboardingIssuesPayload };
  return body.data;
}

export type AdminStripeConnectRequirementRow = {
  id: string;
  displayName: string;
  status: LegalEntityStatus;
};

export async function getAdminLegalEntitiesWithStripeConnectRequirements(): Promise<
  AdminStripeConnectRequirementRow[]
> {
  const res = await authedServerFetch("/admin/legal-entities/stripe-connect-requirements");
  if (!res.ok) {
    throw new Error(`Failed to load legal entities with Stripe requirements: ${res.status}`);
  }
  const body = (await res.json()) as { data: AdminStripeConnectRequirementRow[] };
  return body.data;
}

export async function getAdminMetricsToday(): Promise<AdminTodayMetricsPayload> {
  const res = await authedServerFetch("/admin/metrics/today");
  if (!res.ok) throw new Error(`Failed to load admin metrics: ${res.status}`);
  const body = (await res.json()) as { data: AdminTodayMetricsPayload };
  return body.data;
}

export async function getAdminMetricsLive(): Promise<{ bidsPerMinute: number }> {
  const res = await authedServerFetch("/admin/metrics/live");
  if (!res.ok) throw new Error(`Failed to load live metrics: ${res.status}`);
  const body = (await res.json()) as { data: { bidsPerMinute: number } };
  return body.data;
}

export type AdminAttentionFeedItem = {
  id: string;
  kind: "submission_under_review" | "payment_stale" | "lot_draft_past_start";
  title: string;
  hint: string;
  href: string;
  ctaLabel?: string;
  createdAt: string;
};

export async function getAdminAttentionFeed(): Promise<AdminAttentionFeedItem[]> {
  const res = await authedServerFetch("/admin/attention");
  if (!res.ok) throw new Error(`Failed to load attention feed: ${res.status}`);
  const body = (await res.json()) as { data: AdminAttentionFeedItem[] };
  return body.data;
}

export async function getAdminAnalytics(days = 30): Promise<AdminAnalyticsPayload> {
  const res = await authedServerFetch(`/admin/analytics?days=${encodeURIComponent(String(days))}`);
  if (!res.ok) {
    throw new Error(`Failed to load analytics: ${res.status}`);
  }
  const body = (await res.json()) as { data: AdminAnalyticsPayload };
  return body.data;
}

export type AdminUserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  suspendedAt: string | null;
};

export async function getAdminUserList(params: {
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<{ rows: AdminUserRow[]; total: number }> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  qs.set("limit", String(params.limit ?? 25));
  qs.set("offset", String(params.offset ?? 0));
  const res = await authedServerFetch(`/admin/users?${qs.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to load users: ${res.status}`);
  }
  const json = (await res.json()) as { data: { rows: AdminUserRow[]; total: number } };
  return json.data;
}

export type AdminUserDetailPayload = AdminUserRow & { suspendedReason: string | null };

export async function getAdminUserById(id: string): Promise<AdminUserDetailPayload | null> {
  const res = await authedServerFetch(`/admin/users/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load user: ${res.status}`);
  const body = (await res.json()) as { data: AdminUserDetailPayload };
  return body.data;
}

function parseLegalEntityFromAdminApi(raw: Record<string, unknown>): LegalEntity {
  const status =
    typeof raw.status === "string" && legalEntityStatuses.includes(raw.status as LegalEntityStatus)
      ? (raw.status as LegalEntityStatus)
      : "lead";
  const kind =
    typeof raw.kind === "string" && legalEntityKinds.includes(raw.kind as "individual" | "organisation")
      ? (raw.kind as LegalEntity["kind"])
      : "individual";
  const subkind =
    typeof raw.subkind === "string" &&
    legalEntitySubkinds.includes(raw.subkind as LegalEntity["subkind"])
      ? (raw.subkind as LegalEntity["subkind"])
      : "other";
  const req = raw.stripeConnectRequirementsCurrentlyDue;
  const stripeConnectRequirementsCurrentlyDue = Array.isArray(req)
    ? (req as unknown[]).map((x) => String(x))
    : [];
  return {
    id: String(raw.id ?? ""),
    displayName: String(raw.displayName ?? ""),
    legalName: raw.legalName == null ? null : String(raw.legalName),
    slug: raw.slug == null ? null : String(raw.slug),
    kind,
    subkind,
    createdByUserId: String(raw.createdByUserId ?? ""),
    status,
    statusChangedAt: raw.statusChangedAt ? new Date(String(raw.statusChangedAt)) : null,
    statusChangedByUserId:
      raw.statusChangedByUserId == null ? null : String(raw.statusChangedByUserId),
    stripeConnectAccountId:
      raw.stripeConnectAccountId == null ? null : String(raw.stripeConnectAccountId),
    stripeConnectChargesEnabled: Boolean(raw.stripeConnectChargesEnabled ?? false),
    stripeConnectPayoutsEnabled: Boolean(raw.stripeConnectPayoutsEnabled ?? false),
    stripeConnectRequirementsCurrentlyDue,
    xeroContactId: raw.xeroContactId == null ? null : String(raw.xeroContactId),
    vatNumber: raw.vatNumber == null ? null : String(raw.vatNumber),
    marginSchemeEligible: Boolean(raw.marginSchemeEligible ?? false),
    isLaxManaged: Boolean(raw.isLaxManaged ?? false),
    platformFeeBps: raw.platformFeeBps == null ? null : Number(raw.platformFeeBps),
    createdAt: new Date(String(raw.createdAt ?? "")),
    updatedAt: new Date(String(raw.updatedAt ?? "")),
  };
}

export async function getAdminLegalEntityById(id: string): Promise<LegalEntity | null> {
  const res = await authedServerFetch(`/admin/legal-entities/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load legal entity: ${res.status}`);
  const body = (await res.json()) as { data: Record<string, unknown> };
  return parseLegalEntityFromAdminApi(body.data);
}

export type LotArtistBackfillReviewTask = {
  id: string;
  kind: string;
  status: string;
  targetLotId: string | null;
  payload: Record<string, unknown>;
  createdAt: Date;
};

export async function getLotArtistBackfillReviewTasks(): Promise<LotArtistBackfillReviewTask[]> {
  const res = await authedServerFetch("/admin/lots/artist-backfill-review");
  if (!res.ok) throw new Error(`Failed to load artist backfill tasks: ${res.status}`);
  const body = (await res.json()) as { data: Record<string, unknown>[] };
  return body.data.map((row) => ({
    id: String(row.id ?? ""),
    kind: String(row.kind ?? ""),
    status: String(row.status ?? ""),
    targetLotId: row.targetLotId == null ? null : String(row.targetLotId),
    payload: (row.payload as Record<string, unknown>) ?? {},
    createdAt: new Date(String(row.createdAt ?? "")),
  }));
}
