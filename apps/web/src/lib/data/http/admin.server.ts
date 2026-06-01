import "server-only";

import type { ListLotsParams } from "@/lib/data/contracts";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { buildLotListQuery } from "@/lib/data/http/lots.server";
import { parseLot, parseSale } from "@/lib/data/http/parse";
import type {
  AdminArtistListResult,
  AdminArtistListRow,
  AdminArtistStats,
  AdminCategory,
  ArtistDeleteEligibility,
  ArtistKind,
  ArtistProfile,
  ArtistStatus,
  ItemSubmissionStatus,
  LegalEntity,
  LegalEntityKind,
  LegalEntityStatus,
  LegalEntitySubkind,
  Lot,
  LotStatus,
  PayoutStatus,
  Sale,
} from "@auction/types";
import {
  artistKinds,
  artistStatuses,
  itemSubmissionStatuses,
  legalEntityKinds,
  legalEntityStatuses,
  legalEntitySubkinds,
  lotStatuses,
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
    heroImageKey: o.heroImageKey == null ? null : String(o.heroImageKey),
    createdAt: o.createdAt ? new Date(String(o.createdAt)) : new Date(),
    updatedAt: o.updatedAt ? new Date(String(o.updatedAt)) : new Date(),
    usage: {
      lots,
      sales,
      submissions,
      total: Number(usageRaw.total ?? lots + sales + submissions),
    },
  };
}

function parseArtistCategoryRefs(raw: unknown): NonNullable<ArtistProfile["categories"]> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      const o = entry as Record<string, unknown>;
      return {
        id: String(o.id ?? ""),
        name: String(o.name ?? ""),
        slug: String(o.slug ?? ""),
      };
    })
    .filter((c) => c.id.length > 0);
}

function parseArtistProfile(raw: unknown): ArtistProfile {
  const o = raw as Record<string, unknown>;
  const rawKind = o.kind;
  const kind =
    typeof rawKind === "string" && (artistKinds as readonly string[]).includes(rawKind)
      ? (rawKind as ArtistKind)
      : undefined;
  const rawStatus = o.status;
  const status =
    typeof rawStatus === "string" && (artistStatuses as readonly string[]).includes(rawStatus)
      ? (rawStatus as ArtistStatus)
      : undefined;
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
    countryCode: o.countryCode == null ? null : String(o.countryCode),
    birthYear: o.birthYear == null ? null : String(o.birthYear),
    deathYear: o.deathYear == null ? null : String(o.deathYear),
    foundedYear: o.foundedYear == null ? null : String(o.foundedYear),
    dissolvedYear: o.dissolvedYear == null ? null : String(o.dissolvedYear),
    websiteUrl: o.websiteUrl == null ? null : String(o.websiteUrl),
    socialLinks:
      o.socialLinks && typeof o.socialLinks === "object"
        ? (o.socialLinks as Record<string, string>)
        : {},
    attributes:
      o.attributes && typeof o.attributes === "object"
        ? (o.attributes as Record<string, string>)
        : {},
    featured: Boolean(o.featured),
    verified: Boolean(o.verified),
    archived: Boolean(o.archived),
    ...(kind !== undefined ? { kind } : {}),
    ...(status !== undefined ? { status } : {}),
    categories: parseArtistCategoryRefs(o.categories),
    ownerUserId: o.ownerUserId == null ? null : String(o.ownerUserId),
    ownerLegalEntityId: o.ownerLegalEntityId == null ? null : String(o.ownerLegalEntityId),
    mergedIntoArtistId: o.mergedIntoArtistId == null ? null : String(o.mergedIntoArtistId),
    createdAt: new Date(String(o.createdAt ?? "")),
    updatedAt: new Date(String(o.updatedAt ?? "")),
  };
}

function parseAdminArtistListRow(raw: unknown): AdminArtistListRow {
  const base = parseArtistProfile(raw);
  const o = raw as Record<string, unknown>;
  return {
    ...base,
    lotCount: Number(o.lotCount ?? 0),
    aliasCount: Number(o.aliasCount ?? 0),
    ownerDisplayName: o.ownerDisplayName == null ? null : String(o.ownerDisplayName),
    ownerImage: o.ownerImage == null ? null : String(o.ownerImage),
  };
}

function parseAdminArtistStats(raw: unknown): AdminArtistStats {
  const o = raw as Record<string, unknown>;
  return {
    total: Number(o.total ?? 0),
    pendingReview: Number(o.pendingReview ?? 0),
    makerSellers: Number(o.makerSellers ?? 0),
    historical: Number(o.historical ?? 0),
    brands: Number(o.brands ?? 0),
    featured: Number(o.featured ?? 0),
  };
}

function isPaymentStatus(s: string): s is PaymentStatus {
  return (
    s === "pending" ||
    s === "authorized" ||
    s === "captured" ||
    s === "refunded" ||
    s === "requires_manual_review"
  );
}

function isPayoutStatus(s: unknown): s is PayoutStatus {
  return (
    s === "scheduled" ||
    s === "in_transit" ||
    s === "paid" ||
    s === "failed" ||
    s === "reversed" ||
    s === "clawback_pending"
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
    buyerId: String(o.buyerId ?? o.paidByUserId ?? ""),
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

/** Matches {@link listLotsQuerySchema} max on the API. */
const ADMIN_LOT_LIST_MAX_LIMIT = 100;

export async function getAdminLotList(
  params: ListLotsParams = {},
): Promise<Array<Lot & { lifecycleSummary?: AdminLotLifecycleSummary }>> {
  const qs = new URLSearchParams(
    buildLotListQuery({
      ...params,
      limit: Math.min(params.limit ?? ADMIN_LOT_LIST_MAX_LIMIT, ADMIN_LOT_LIST_MAX_LIMIT),
      offset: params.offset ?? 0,
    }),
  );
  const res = await authedServerFetch(`/lots?${qs.toString()}`);
  if (!res.ok) {
    let detail = "";
    if (res.status === 400) {
      try {
        const j = (await res.clone().json()) as { message?: string };
        detail = j.message ? ` — ${String(j.message).slice(0, 280)}` : "";
      } catch {
        // ignore
      }
    }
    throw new Error(`Failed to load lots: ${res.status}${detail}`);
  }
  const body = (await res.json()) as { data: unknown[] };
  return body.data.map((raw) => {
    const o = raw as Record<string, unknown>;
    const lot = parseLot(raw);
    const ls = o.lifecycleSummary as Record<string, unknown> | undefined;
    const deleteEligibility = parseLotDeleteEligibility(o.deleteEligibility);
    const lifecycleSummary =
      ls && typeof ls.lastEventType === "string" && typeof ls.lastEventAt === "string"
        ? {
            lastEventType: ls.lastEventType,
            lastEventAt: ls.lastEventAt,
            returnCount: Number(ls.returnCount ?? 0),
          }
        : undefined;
    return {
      ...lot,
      ...(lifecycleSummary ? { lifecycleSummary } : {}),
      ...(deleteEligibility != null ? { deleteEligibility } : {}),
    };
  });
}

export type AdminLotLifecycleSummary = {
  lastEventType: string;
  lastEventAt: string;
  returnCount: number;
};

export async function getAdminCategoryList(
  params: {
    includeArchived?: boolean;
    q?: string;
  } = {},
): Promise<AdminCategory[]> {
  const qs = new URLSearchParams();
  if (params.includeArchived) qs.set("includeArchived", "true");
  const res = await authedServerFetch(`/admin/categories${qs.size ? `?${qs.toString()}` : ""}`);
  if (!res.ok) throw new Error(`Failed to load categories: ${res.status}`);
  const body = (await res.json()) as { data: unknown[] };
  const categories = body.data.map(parseAdminCategory);
  const needle = params.q?.trim().toLowerCase();
  if (!needle) return categories;
  return categories.filter((category) =>
    [category.name, category.slug, category.description ?? ""].some((value) =>
      value.toLowerCase().includes(needle),
    ),
  );
}

export async function getAdminCategoryById(id: string): Promise<AdminCategory | null> {
  const res = await authedServerFetch(`/admin/categories/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load category: ${res.status}`);
  const body = (await res.json()) as { data: unknown };
  return parseAdminCategory(body.data);
}

export type GetAdminArtistListParams = {
  includeArchived?: boolean;
  archivedOnly?: boolean;
  q?: string;
  kind?: string;
  kinds?: string;
  status?: string;
  ownerUserId?: string;
  categoryId?: string;
  country?: string;
  featured?: boolean;
  verified?: boolean;
  linked?: "yes" | "no";
  sort?: string;
  limit?: number;
  offset?: number;
};

/** Matches {@link adminArtistListQuerySchema} max on the API. */
const ADMIN_ARTIST_LIST_MAX_LIMIT = 200;

export async function getAdminArtistList(
  params: GetAdminArtistListParams = {},
): Promise<AdminArtistListResult> {
  const qs = new URLSearchParams();
  if (params.includeArchived) qs.set("includeArchived", "true");
  if (params.archivedOnly) qs.set("archivedOnly", "true");
  if (params.q) qs.set("q", params.q);
  if (params.kind) qs.set("kind", params.kind);
  if (params.kinds) qs.set("kinds", params.kinds);
  if (params.status) qs.set("status", params.status);
  if (params.ownerUserId) qs.set("ownerUserId", params.ownerUserId);
  if (params.categoryId) qs.set("categoryId", params.categoryId);
  if (params.country) qs.set("country", params.country);
  if (params.featured === true) qs.set("featured", "true");
  if (params.verified === true) qs.set("verified", "true");
  if (params.linked) qs.set("linked", params.linked);
  if (params.sort) qs.set("sort", params.sort);
  const limit = Math.min(ADMIN_ARTIST_LIST_MAX_LIMIT, Math.max(10, params.limit ?? 50));
  qs.set("limit", String(limit));
  qs.set("offset", String(params.offset ?? 0));
  const query = qs.toString();
  const res = await authedServerFetch(`/admin/artists?${query}`);
  if (!res.ok) throw new Error(`Failed to load artists: ${res.status}`);
  const body = (await res.json()) as { data: { rows: unknown[]; total: number } };
  return {
    rows: body.data.rows.map(parseAdminArtistListRow),
    total: body.data.total,
  };
}

export async function getAdminArtistStats(): Promise<AdminArtistStats> {
  const res = await authedServerFetch("/admin/artists/stats");
  if (!res.ok) throw new Error(`Failed to load artist stats: ${res.status}`);
  const body = (await res.json()) as { data: unknown };
  return parseAdminArtistStats(body.data);
}

export type AdminArtistDuplicateHit = {
  id: string;
  displayName: string;
  slug: string;
  kind: ArtistKind;
  status: ArtistStatus;
  matchedAlias: string | null;
  matchType: string;
  score: number;
};

export async function getAdminArtistDuplicateCandidates(
  artistId: string,
): Promise<AdminArtistDuplicateHit[]> {
  const res = await authedServerFetch(`/admin/artists/${encodeURIComponent(artistId)}/duplicates`);
  if (!res.ok) throw new Error(`Failed to load duplicate candidates: ${res.status}`);
  const body = (await res.json()) as { data: unknown[] };
  return body.data.map((raw) => {
    const o = raw as Record<string, unknown>;
    const k = o.kind;
    const kind =
      typeof k === "string" && (artistKinds as readonly string[]).includes(k)
        ? (k as ArtistKind)
        : "artist";
    const st = o.status;
    const status =
      typeof st === "string" && (artistStatuses as readonly string[]).includes(st)
        ? (st as ArtistStatus)
        : "approved";
    return {
      id: String(o.id ?? ""),
      displayName: String(o.displayName ?? ""),
      slug: String(o.slug ?? ""),
      kind,
      status,
      matchedAlias: o.matchedAlias == null ? null : String(o.matchedAlias),
      matchType: String(o.matchType ?? ""),
      score: Number(o.score ?? 0),
    };
  });
}

/** Artist profiles where `ownerUserId` matches (includes archived). */
export async function getAdminArtistsByOwnerUserId(ownerUserId: string): Promise<ArtistProfile[]> {
  const { rows } = await getAdminArtistList({ ownerUserId, includeArchived: true, limit: 200 });
  return rows;
}

export async function getAdminArtistById(id: string): Promise<ArtistProfile | null> {
  const res = await authedServerFetch(`/admin/artists/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load artist: ${res.status}`);
  const body = (await res.json()) as { data: unknown };
  return parseArtistProfile(body.data);
}

function parseArtistDeleteEligibility(raw: unknown): ArtistDeleteEligibility | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const guardsRaw = o.guards;
  const guards =
    guardsRaw && typeof guardsRaw === "object"
      ? {
          lotCount: Number((guardsRaw as Record<string, unknown>).lotCount ?? 0),
          mergeDependentCount: Number(
            (guardsRaw as Record<string, unknown>).mergeDependentCount ?? 0,
          ),
          watchlistCount: Number((guardsRaw as Record<string, unknown>).watchlistCount ?? 0),
        }
      : { lotCount: 0, mergeDependentCount: 0, watchlistCount: 0 };
  return {
    canDelete: o.canDelete === true,
    blockers: Array.isArray(o.blockers) ? o.blockers.map(String) : [],
    warnings: Array.isArray(o.warnings) ? o.warnings.map(String) : [],
    confirmationPhrase: typeof o.confirmationPhrase === "string" ? o.confirmationPhrase : null,
    guards,
  };
}

export async function getAdminArtistDeleteEligibility(
  artistId: string,
): Promise<ArtistDeleteEligibility | null> {
  const res = await authedServerFetch(
    `/artists/${encodeURIComponent(artistId)}/delete-eligibility`,
  );
  if (res.status === 404) return null;
  if (res.status === 403) return null;
  if (!res.ok) throw new Error(`Failed to load artist delete eligibility: ${res.status}`);
  const body = (await res.json()) as { data: unknown };
  return parseArtistDeleteEligibility(body.data);
}

export type AdminSaleListRow = {
  sale: Sale;
  lots: Lot[];
  deleteEligibility?: SaleDeleteEligibility | null;
};

export type SaleDeleteEligibility = {
  canDelete: boolean;
  confirmationPhrase: string | null;
  guards: {
    bidCount: number;
    paymentCount: number;
    approvedRegistrationCount: number;
  };
  blockers: string[];
};

function parseSaleDeleteEligibility(raw: unknown): SaleDeleteEligibility | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const guardsRaw = o.guards;
  const guards =
    guardsRaw && typeof guardsRaw === "object"
      ? {
          bidCount: Number((guardsRaw as Record<string, unknown>).bidCount ?? 0),
          paymentCount: Number((guardsRaw as Record<string, unknown>).paymentCount ?? 0),
          approvedRegistrationCount: Number(
            (guardsRaw as Record<string, unknown>).approvedRegistrationCount ?? 0,
          ),
        }
      : { bidCount: 0, paymentCount: 0, approvedRegistrationCount: 0 };
  const blockers = Array.isArray(o.blockers) ? o.blockers.map(String) : [];
  return {
    canDelete: o.canDelete === true,
    confirmationPhrase:
      o.confirmationPhrase == null || o.confirmationPhrase === ""
        ? null
        : String(o.confirmationPhrase),
    guards,
    blockers,
  };
}

export async function getAdminSalesList(
  params: {
    status?: Sale["status"];
    q?: string;
    deliveryMode?: Sale["deliveryMode"];
    settlementStatus?: "settled" | "unsettled";
    categoryId?: string;
    limit?: number;
    offset?: number;
    sort?: "createdDesc" | "startAsc";
    needsSetup?: boolean;
  } = {},
): Promise<AdminSaleListRow[]> {
  const qs = new URLSearchParams();
  // GET /sales rejects limit > 100 (listSalesQuerySchema.max(100)).
  qs.set("limit", String(Math.min(params.limit ?? 50, 100)));
  qs.set("offset", String(params.offset ?? 0));
  if (params.status) qs.set("status", params.status);
  if (params.q?.trim()) qs.set("q", params.q.trim());
  if (params.deliveryMode) qs.set("deliveryMode", params.deliveryMode);
  if (params.settlementStatus) qs.set("settlementStatus", params.settlementStatus);
  if (params.categoryId) qs.set("categoryId", params.categoryId);
  if (params.sort) qs.set("sort", params.sort);
  if (params.needsSetup) qs.set("needsSetup", "1");
  const res = await authedServerFetch(`/sales?${qs.toString()}`);
  if (!res.ok) throw new Error(`Failed to load sales: ${res.status}`);
  const body = (await res.json()) as {
    data: { sale: unknown; lots: unknown[]; deleteEligibility?: unknown }[];
  };
  return body.data.map((row) => ({
    sale: parseSale(row.sale),
    lots: row.lots.map(parseLot),
    ...(row.deleteEligibility != null
      ? { deleteEligibility: parseSaleDeleteEligibility(row.deleteEligibility) }
      : {}),
  }));
}

export type AdminSaleDetailRow = AdminSaleListRow & {
  sale: AdminSaleListRow["sale"] & {
    coverImagePresentedUrls?: string[];
  };
};

export async function getAdminSaleById(id: string): Promise<AdminSaleDetailRow | null> {
  const res = await authedServerFetch(`/sales/${encodeURIComponent(id)}/catalog-admin`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load sale: ${res.status}`);
  const body = (await res.json()) as {
    data: { sale: unknown; lots: unknown[]; deleteEligibility?: unknown };
  };
  const saleRaw = body.data.sale as Record<string, unknown>;
  const coverImagePresentedUrls = Array.isArray(saleRaw.coverImagePresentedUrls)
    ? (saleRaw.coverImagePresentedUrls as unknown[]).map(String)
    : undefined;
  const sale = parseSale(saleRaw);
  const deleteEligibility = parseSaleDeleteEligibility(body.data.deleteEligibility);
  return {
    sale: coverImagePresentedUrls !== undefined ? { ...sale, coverImagePresentedUrls } : sale,
    lots: body.data.lots.map(parseLot),
    ...(deleteEligibility ? { deleteEligibility } : {}),
  };
}

export type AdminSaleRegistrationRow = {
  id: string;
  saleId: string;
  userId: string;
  buyerLegalEntityId: string;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  requestedAt: string;
  decidedAt: string | null;
  decidedByUserId: string | null;
  bidLimit: string | null;
  laxNotes: string | null;
  rejectionReason: string | null;
  userEmail: string | null;
  userName: string | null;
  buyerLegalEntityDisplayName: string | null;
  /** Active membership role for the bidder on the buying entity (if any). */
  memberRole: string | null;
};

const adminSaleRegistrationStatuses = ["pending", "approved", "rejected", "withdrawn"] as const;

function parseAdminSaleRegistrationRow(raw: unknown): AdminSaleRegistrationRow {
  const o = raw as Record<string, unknown>;
  const st = o.status;
  const status =
    typeof st === "string" && (adminSaleRegistrationStatuses as readonly string[]).includes(st)
      ? (st as AdminSaleRegistrationRow["status"])
      : "pending";
  return {
    id: String(o.id ?? ""),
    saleId: String(o.saleId ?? ""),
    userId: String(o.userId ?? ""),
    buyerLegalEntityId: String(o.buyerLegalEntityId ?? ""),
    status,
    requestedAt: typeof o.requestedAt === "string" ? o.requestedAt : "",
    decidedAt: o.decidedAt == null || o.decidedAt === "" ? null : String(o.decidedAt),
    decidedByUserId: o.decidedByUserId == null ? null : String(o.decidedByUserId),
    bidLimit: o.bidLimit == null ? null : String(o.bidLimit),
    laxNotes: o.laxNotes == null ? null : String(o.laxNotes),
    rejectionReason: o.rejectionReason == null ? null : String(o.rejectionReason),
    userEmail: o.userEmail == null ? null : String(o.userEmail),
    userName: o.userName == null ? null : String(o.userName),
    buyerLegalEntityDisplayName:
      o.buyerLegalEntityDisplayName == null ? null : String(o.buyerLegalEntityDisplayName),
    memberRole: o.memberRole == null || o.memberRole === "" ? null : String(o.memberRole),
  };
}

export async function getAdminSaleRegistrations(
  saleId: string,
  params?: { status?: AdminSaleRegistrationRow["status"] },
): Promise<AdminSaleRegistrationRow[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  const suffix = qs.size ? `?${qs.toString()}` : "";
  const res = await authedServerFetch(
    `/admin/sales/${encodeURIComponent(saleId)}/registrations${suffix}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Failed to load sale registrations: ${res.status}`);
  const body = (await res.json()) as { data: { items: unknown[] } };
  return body.data.items.map(parseAdminSaleRegistrationRow);
}

export type AdminConditionReportRequestRow = {
  id: string;
  lotId: string;
  requestedByUserId: string;
  requestingLegalEntityId: string | null;
  status: "pending" | "in_progress" | "fulfilled" | "declined";
  requestNote: string | null;
  responseNote: string | null;
  responseAttachmentUploadId: string | null;
  fulfilledByUserId: string | null;
  fulfilledAt: string | null;
  createdAt: string;
  lotTitle: string | null;
  requesterEmail: string | null;
};

const crStatuses = ["pending", "in_progress", "fulfilled", "declined"] as const;

function parseAdminConditionReportRequestRow(raw: unknown): AdminConditionReportRequestRow {
  const o = raw as Record<string, unknown>;
  const st = o.status;
  const status =
    typeof st === "string" && (crStatuses as readonly string[]).includes(st)
      ? (st as AdminConditionReportRequestRow["status"])
      : "pending";
  return {
    id: String(o.id ?? ""),
    lotId: String(o.lotId ?? ""),
    requestedByUserId: String(o.requestedByUserId ?? ""),
    requestingLegalEntityId:
      o.requestingLegalEntityId == null ? null : String(o.requestingLegalEntityId),
    status,
    requestNote: o.requestNote == null ? null : String(o.requestNote),
    responseNote: o.responseNote == null ? null : String(o.responseNote),
    responseAttachmentUploadId:
      o.responseAttachmentUploadId == null ? null : String(o.responseAttachmentUploadId),
    fulfilledByUserId: o.fulfilledByUserId == null ? null : String(o.fulfilledByUserId),
    fulfilledAt: o.fulfilledAt == null ? null : String(o.fulfilledAt),
    createdAt: typeof o.createdAt === "string" ? o.createdAt : "",
    lotTitle: o.lotTitle == null ? null : String(o.lotTitle),
    requesterEmail: o.requesterEmail == null ? null : String(o.requesterEmail),
  };
}

export async function getAdminConditionReportRequests(params?: {
  status?: "open" | AdminConditionReportRequestRow["status"];
  lotId?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  items: AdminConditionReportRequestRow[];
  total: number;
  limit: number;
  offset: number;
}> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.lotId) qs.set("lotId", params.lotId);
  qs.set("limit", String(params?.limit ?? 50));
  qs.set("offset", String(params?.offset ?? 0));
  const res = await authedServerFetch(`/admin/condition-report-requests?${qs.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to load condition report requests: ${res.status}`);
  const body = (await res.json()) as {
    data: { items: unknown[]; total: number; limit: number; offset: number };
  };
  return {
    items: body.data.items.map(parseAdminConditionReportRequestRow),
    total: body.data.total,
    limit: body.data.limit,
    offset: body.data.offset,
  };
}

export type LotDeleteEligibility = {
  canDelete: boolean;
  confirmationPhrase: string | null;
  blockers: string[];
};

function parseLotDeleteEligibility(raw: unknown): LotDeleteEligibility | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const blockers = Array.isArray(o.blockers) ? o.blockers.map(String) : [];
  return {
    canDelete: o.canDelete === true,
    confirmationPhrase:
      o.confirmationPhrase == null || o.confirmationPhrase === ""
        ? null
        : String(o.confirmationPhrase),
    blockers,
  };
}

export async function getAdminLotById(id: string): Promise<Lot | null> {
  const detail = await getAdminLotDetail(id);
  return detail?.auction ?? null;
}

export async function getAdminLotDetail(id: string): Promise<{
  auction: Lot;
  deleteEligibility: LotDeleteEligibility | null;
} | null> {
  const res = await authedServerFetch(`/lots/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to load lot: ${res.status}`);
  }
  const body = (await res.json()) as { data: unknown };
  const data = body.data;
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const deleteEligibility = parseLotDeleteEligibility(record.deleteEligibility);
  const { deleteEligibility: _omit, ...lotRaw } = record;
  return {
    auction: parseLot(lotRaw),
    deleteEligibility,
  };
}

/** Resolve lots referenced by id (e.g. payment rows) without scanning the full lot list. */
export async function getAdminLotsByIds(lotIds: string[]): Promise<Lot[]> {
  const unique = [...new Set(lotIds.filter(Boolean))];
  if (unique.length === 0) return [];
  const lots = await Promise.all(unique.map((id) => getAdminLotById(id)));
  return lots.filter((lot): lot is Lot => lot != null);
}

export async function getAdminPaymentList(): Promise<AdminPaymentRow[]> {
  const res = await authedServerFetch("/payments");
  if (!res.ok) {
    throw new Error(`Failed to load payments: ${res.status}`);
  }
  const body = (await res.json()) as { data: unknown[] };
  return body.data.map(parseAdminPaymentRow);
}

export async function getAdminPaymentsForUser(userId: string): Promise<AdminPaymentRow[]> {
  const all = await getAdminPaymentList();
  return all.filter((p) => p.buyerId === userId);
}

export async function getAdminLotsWonByUser(userId: string, limit = 20): Promise<Lot[]> {
  return getAdminLotList({ winnerId: userId, limit, offset: 0 });
}

export type AdminLotFulfilmentListRow = {
  id: string;
  lotId: string;
  lotTitle: string | null;
  status: string;
  paymentId: string | null;
  fulfilmentMethod: string | null;
  shippingCarrier: string | null;
  trackingNumber: string | null;
};

function parseAdminLotFulfilmentListRow(raw: unknown): AdminLotFulfilmentListRow {
  const o = raw as Record<string, unknown>;
  return {
    id: String(o.id ?? ""),
    lotId: String(o.lotId ?? ""),
    lotTitle: o.lotTitle == null ? null : String(o.lotTitle),
    status: String(o.status ?? ""),
    paymentId: o.paymentId == null ? null : String(o.paymentId),
    fulfilmentMethod: o.fulfilmentMethod == null ? null : String(o.fulfilmentMethod),
    shippingCarrier: o.shippingCarrier == null ? null : String(o.shippingCarrier),
    trackingNumber: o.trackingNumber == null ? null : String(o.trackingNumber),
  };
}

async function fetchAdminLotFulfilmentListResponse(params?: {
  status?: string;
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<
  | {
      kind: "ok";
      rows: AdminLotFulfilmentListRow[];
      total: number;
      statusCounts: Record<string, number>;
    }
  | { kind: "authz" }
  | { kind: "error"; message: string }
> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.q) qs.set("q", params.q);
  if (params?.limit != null) qs.set("limit", String(params.limit));
  if (params?.offset != null) qs.set("offset", String(params.offset));
  const suffix = qs.size ? `?${qs.toString()}` : "";
  const res = await authedServerFetch(`/admin/lot-fulfilment${suffix}`, { cache: "no-store" });
  if (res.status === 403 || res.status === 401) return { kind: "authz" };
  if (!res.ok) {
    return { kind: "error", message: `Failed to load lot fulfilment: ${res.status}` };
  }
  const body = (await res.json()) as {
    data: unknown[];
    meta?: { total?: number; statusCounts?: Record<string, number> };
  };
  return {
    kind: "ok",
    rows: body.data.map(parseAdminLotFulfilmentListRow),
    total: body.meta?.total ?? body.data.length,
    statusCounts: body.meta?.statusCounts ?? {},
  };
}

/** Operations fulfilment capability; returns empty when the user cannot access the queue. */
export async function getAdminLotFulfilmentList(params?: {
  status?: string;
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<AdminLotFulfilmentListRow[]> {
  const r = await fetchAdminLotFulfilmentListResponse(params);
  if (r.kind === "authz") return [];
  if (r.kind === "error") throw new Error(r.message);
  return r.rows;
}

export type LotFulfilmentQueueLoadResult =
  | {
      access: "ok";
      rows: AdminLotFulfilmentListRow[];
      total: number;
      statusCounts: Record<string, number>;
    }
  | { access: "forbidden" }
  | { access: "error"; message: string };

/** Same list as {@link getAdminLotFulfilmentList}, but distinguishes 403 from an empty queue. */
export async function loadAdminLotFulfilmentQueue(params?: {
  status?: string;
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<LotFulfilmentQueueLoadResult> {
  const r = await fetchAdminLotFulfilmentListResponse(params);
  if (r.kind === "authz") return { access: "forbidden" };
  if (r.kind === "error") return { access: "error", message: r.message };
  return { access: "ok", rows: r.rows, total: r.total, statusCounts: r.statusCounts };
}

export type AdminConveyorPipelineRow = {
  submissionId: string;
  title: string;
  submissionStatus: ItemSubmissionStatus;
  convertedLotId: string | null;
  lotId: string | null;
  lotStatus: LotStatus | null;
  lotTitle: string | null;
  artistReviewRequired: boolean | null;
  archivedSeller: boolean | null;
  assignedToUserId: string | null;
  updatedAt: string;
};

function parseAdminConveyorPipelineRow(raw: unknown): AdminConveyorPipelineRow {
  const o = raw as Record<string, unknown>;
  const subSt = String(o.submissionStatus ?? "");
  const submissionStatus: ItemSubmissionStatus = (
    itemSubmissionStatuses as readonly string[]
  ).includes(subSt)
    ? (subSt as ItemSubmissionStatus)
    : "draft";
  const rawLotSt = o.lotStatus == null ? null : String(o.lotStatus);
  const lotStatus: LotStatus | null =
    rawLotSt === null
      ? null
      : (lotStatuses as readonly string[]).includes(rawLotSt)
        ? (rawLotSt as LotStatus)
        : null;
  return {
    submissionId: String(o.submissionId ?? ""),
    title: String(o.title ?? ""),
    submissionStatus,
    convertedLotId: o.convertedLotId == null ? null : String(o.convertedLotId),
    lotId: o.lotId == null ? null : String(o.lotId),
    lotStatus,
    lotTitle: o.lotTitle == null ? null : String(o.lotTitle),
    artistReviewRequired:
      typeof o.artistReviewRequired === "boolean" ? o.artistReviewRequired : null,
    archivedSeller: typeof o.archivedSeller === "boolean" ? o.archivedSeller : null,
    assignedToUserId: o.assignedToUserId == null ? null : String(o.assignedToUserId),
    updatedAt: String(o.updatedAt ?? ""),
  };
}

export async function getAdminConveyorPipeline(params?: {
  limit?: number;
}): Promise<AdminConveyorPipelineRow[]> {
  const qs = new URLSearchParams();
  if (params?.limit != null) qs.set("limit", String(params.limit));
  const suffix = qs.size ? `?${qs.toString()}` : "";
  const res = await authedServerFetch(`/admin/conveyor-pipeline${suffix}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load conveyor pipeline: ${res.status}`);
  const body = (await res.json()) as { data: unknown[] };
  return body.data.map(parseAdminConveyorPipelineRow);
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

export type AdminXeroConnectionHealth = "healthy" | "degraded" | "disconnected";

export type AdminXeroIntegrationStatus = {
  connected: boolean;
  tenantId: string | null;
  tenantName: string | null;
  expiresAt: string | null;
  oauthConfigured: boolean;
  connectedAt: string | null;
  updatedAt: string | null;
  connectedBy: { id: string; name: string; email: string } | null;
  scopes: string | null;
  webhookConfigured: boolean;
  webhookUrl: string | null;
  recentWebhookErrors: number;
  syncErrorCount: number;
  health: AdminXeroConnectionHealth;
  connectionStatus: "healthy" | "needs_reauth" | null;
  lastRefreshError: string | null;
  orgShortCode: string | null;
  orgBaseCurrency: string | null;
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
  staleBlockedScheduledPayoutCount: number;
  entitiesPendingReviewCount: number;
  artistsPendingApprovalCount: number;
  staleKycSessionsCount: number;
  documentsAwaitingReviewCount: number;
  staleLeadOrganisationsCount: number;
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
  staleKycSessions: {
    id: string;
    userId: string;
    userName: string | null;
    userEmail: string | null;
    provider: string;
    status: string;
    createdAt: string;
  }[];
  documentsAwaitingReview: {
    id: string;
    legalEntityId: string;
    entityDisplayName: string;
    uploadObjectId: string;
    uploadedAt: string;
  }[];
  staleLeadOrganisations: { id: string; displayName: string; createdAt: string }[];
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
  stripeConnectRequirementsCurrentlyDue: string[];
};

export async function getAdminLegalEntitiesWithStripeConnectRequirements(): Promise<
  AdminStripeConnectRequirementRow[]
> {
  const res = await authedServerFetch("/admin/legal-entities/stripe-connect-requirements");
  if (!res.ok) {
    throw new Error(`Failed to load legal entities with Stripe requirements: ${res.status}`);
  }
  const body = (await res.json()) as { data: Record<string, unknown>[] };
  return body.data.map((row) => ({
    id: String(row.id ?? ""),
    displayName: String(row.displayName ?? ""),
    status: row.status as LegalEntityStatus,
    stripeConnectRequirementsCurrentlyDue: Array.isArray(row.stripeConnectRequirementsCurrentlyDue)
      ? row.stripeConnectRequirementsCurrentlyDue.map(String)
      : [],
  }));
}

/** Narrow row for admin picker UIs (matches GET /admin/legal-entities/browse). */
export type AdminLegalEntityPickerRow = {
  id: string;
  displayName: string;
  status: LegalEntityStatus;
};

/** Directory list row from GET /admin/legal-entities/browse. */
export type AdminLegalEntityListRow = {
  id: string;
  displayName: string;
  status: LegalEntityStatus;
  kind: LegalEntityKind;
  subkind: LegalEntitySubkind;
  updatedAt: string;
  stripeDueCount: number;
};

export type AdminLegalEntityListResult = {
  rows: AdminLegalEntityListRow[];
  total: number;
};

function parseLegalEntityBrowseRow(row: {
  id: string;
  displayName: string;
  status: string;
  kind?: string;
  subkind?: string;
  updatedAt?: string | Date;
  stripeDueCount?: number;
}): AdminLegalEntityListRow {
  const status =
    typeof row.status === "string" && legalEntityStatuses.includes(row.status as LegalEntityStatus)
      ? (row.status as LegalEntityStatus)
      : "lead";
  const kind =
    typeof row.kind === "string" && legalEntityKinds.includes(row.kind as LegalEntityKind)
      ? (row.kind as LegalEntityKind)
      : "organisation";
  const subkind =
    typeof row.subkind === "string" &&
    legalEntitySubkinds.includes(row.subkind as LegalEntitySubkind)
      ? (row.subkind as LegalEntitySubkind)
      : "other";
  const updatedAt =
    row.updatedAt instanceof Date
      ? row.updatedAt.toISOString()
      : typeof row.updatedAt === "string"
        ? row.updatedAt
        : new Date(0).toISOString();

  return {
    id: row.id,
    displayName: row.displayName,
    status,
    kind,
    subkind,
    updatedAt,
    stripeDueCount: Number(row.stripeDueCount ?? 0),
  };
}

/** Supports `{ rows, total }` and legacy bare-array browse responses. */
function parseAdminLegalEntityBrowsePayload(data: unknown): AdminLegalEntityListResult {
  if (Array.isArray(data)) {
    const rows = data.map((row) => parseLegalEntityBrowseRow(row));
    return { rows, total: rows.length };
  }

  if (data && typeof data === "object" && "rows" in data) {
    const payload = data as { rows?: unknown; total?: unknown };
    const rawRows = Array.isArray(payload.rows) ? payload.rows : [];
    const rows = rawRows.map((row) => parseLegalEntityBrowseRow(row));
    const total =
      typeof payload.total === "number"
        ? payload.total
        : Number.parseInt(String(payload.total ?? ""), 10) || rows.length;
    return { rows, total };
  }

  return { rows: [], total: 0 };
}

export async function getAdminLegalEntityList(params: {
  q?: string;
  status?: LegalEntityStatus;
  kind?: LegalEntityKind;
  stripeDue?: boolean;
  createdByUserId?: string;
  limit?: number;
  offset?: number;
}): Promise<AdminLegalEntityListResult> {
  const qs = new URLSearchParams();
  if (params.q?.trim()) qs.set("q", params.q.trim());
  if (params.status) qs.set("status", params.status);
  if (params.kind) qs.set("kind", params.kind);
  if (params.stripeDue) qs.set("stripeDue", "1");
  if (params.createdByUserId) qs.set("createdByUserId", params.createdByUserId);
  qs.set("limit", String(params.limit ?? 25));
  qs.set("offset", String(params.offset ?? 0));
  const res = await authedServerFetch(`/admin/legal-entities/browse?${qs.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to load legal entities: ${res.status}`);
  }
  const body = (await res.json()) as { data: unknown };
  return parseAdminLegalEntityBrowsePayload(body.data);
}

export async function searchAdminLegalEntitiesForPicker(params: {
  q?: string;
  createdByUserId?: string;
  limit?: number;
  offset?: number;
}): Promise<AdminLegalEntityPickerRow[]> {
  const result = await getAdminLegalEntityList({
    ...(params.q?.trim() ? { q: params.q.trim() } : {}),
    ...(params.createdByUserId ? { createdByUserId: params.createdByUserId } : {}),
    limit: params.limit ?? 25,
    offset: params.offset ?? 0,
  });
  return result.rows.map((row) => ({
    id: row.id,
    displayName: row.displayName,
    status: row.status,
  }));
}

export type AdminLotPickerRow = {
  id: string;
  title: string;
  lifecycle: {
    kind: "new_draft" | "returned";
    returnedAt: string | null;
    lastSaleId: string | null;
    lastSaleName: string | null;
    returnCount: number;
  };
};

export class AdminLotBrowseError extends Error {
  readonly status: number;

  constructor(status: number) {
    const hint = status === 404 ? " (browse endpoint missing — restart/rebuild API)" : "";
    super(`Failed to browse lots: ${status}${hint}`);
    this.name = "AdminLotBrowseError";
    this.status = status;
  }
}

export async function getAdminLotBrowse(params: {
  q?: string;
  sellerLegalEntityId?: string;
  categoryIds?: string[];
  artistId?: string;
  state?: "available" | "returned" | "all";
  excludeSaleId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ rows: AdminLotPickerRow[]; total: number }> {
  const qs = new URLSearchParams();
  if (params.q?.trim()) qs.set("q", params.q.trim());
  if (params.sellerLegalEntityId) qs.set("sellerLegalEntityId", params.sellerLegalEntityId);
  if (params.categoryIds?.length) qs.set("categoryIds", params.categoryIds.join(","));
  if (params.artistId) qs.set("artistId", params.artistId);
  if (params.state) qs.set("state", params.state);
  if (params.excludeSaleId) qs.set("excludeSaleId", params.excludeSaleId);
  qs.set("limit", String(params.limit ?? 25));
  qs.set("offset", String(params.offset ?? 0));
  const res = await authedServerFetch(`/admin/lots/browse?${qs.toString()}`);
  if (!res.ok) throw new AdminLotBrowseError(res.status);
  const body = (await res.json()) as { data: AdminLotPickerRow[]; total: number };
  return { rows: body.data, total: body.total };
}

export type AdminLotLifecyclePayload = {
  snapshot: {
    currentStatus: string;
    lastEventType: string;
    lastEventAt: string;
    lastSaleId: string | null;
    returnCount: number;
  } | null;
  events: {
    eventType: string;
    occurredAt: string;
    saleTitle?: string | null;
  }[];
};

export async function getAdminLotLifecycle(lotId: string): Promise<AdminLotLifecyclePayload> {
  const res = await authedServerFetch(`/admin/lots/${encodeURIComponent(lotId)}/lifecycle`);
  if (!res.ok) throw new Error(`Failed to load lot lifecycle: ${res.status}`);
  const body = (await res.json()) as { data: AdminLotLifecyclePayload };
  return body.data;
}

export async function getAdminLegalEntitiesForUser(userId: string): Promise<LegalEntity[]> {
  const pickerRows = await searchAdminLegalEntitiesForPicker({
    createdByUserId: userId,
    limit: 50,
    offset: 0,
  });
  const entities = await Promise.all(pickerRows.map((row) => getAdminLegalEntityById(row.id)));
  return entities.filter((e): e is LegalEntity => e != null);
}

export type AdminManualReviewPaymentRow = {
  paymentId: string;
  lotId: string;
  lotTitle: string;
  lotNumber: number | null;
  winnerUserId: string;
  winnerEmail: string;
  sellerLegalEntityId: string;
  sellerDisplayName: string;
  sellerStatus: LegalEntityStatus;
  sellerArchivedAt: string | null;
  amount: string;
  currency: string;
  archiveReason: string | null;
  archiveTimestamp: string | null;
  manualReviewReason:
    | "seller_archived"
    | "high_value"
    | "seller_archived_and_high_value"
    | "aml_hold"
    | "source_of_funds_required"
    | null;
  createdAt: string;
};

export async function getAdminManualReviewPayments(): Promise<AdminManualReviewPaymentRow[]> {
  const res = await authedServerFetch("/admin/payments/manual-review");
  if (!res.ok) throw new Error(`Failed to load manual review payments: ${res.status}`);
  const body = (await res.json()) as { data: AdminManualReviewPaymentRow[] };
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
  firstName: string | null;
  lastName: string | null;
  role: string;
  staffRole: string | null;
  createdAt: string;
  updatedAt: string;
  suspendedAt: string | null;
  image: string | null;
  mobile: string | null;
  mobileCountry: string | null;
  emailVerified: boolean;
  emailStatus: string;
  signupPersona: string | null;
  twoFactorEnabled: boolean;
  kycStatus: string;
  kycVerifiedAt: string | null;
  kycRetryCount: number;
  deletionRequestedAt: string | null;
};

export type GetAdminUserListParams = {
  q?: string;
  limit?: number;
  offset?: number;
  role?: string;
  staffRole?: string;
  suspendedOnly?: boolean;
  accountStatus?: "active" | "suspended";
  emailVerified?: boolean;
  emailStatus?: "ok" | "bounced" | "complained";
  kycStatus?: string;
  kycStatuses?: string[];
  persona?: "individual" | "organisation" | "none";
  twoFactorEnabled?: boolean;
  deletionRequestedOnly?: boolean;
  hasMobile?: boolean;
  createdFrom?: string;
  createdTo?: string;
  kycVerifiedFrom?: string;
  kycVerifiedTo?: string;
  lastActiveFrom?: string;
  lastActiveTo?: string;
  sort?: string;
};

export async function getAdminUserList(
  params: GetAdminUserListParams,
): Promise<{ rows: AdminUserRow[]; total: number }> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  qs.set("limit", String(params.limit ?? 25));
  qs.set("offset", String(params.offset ?? 0));
  if (params.role) qs.set("role", params.role);
  if (params.staffRole) qs.set("staffRole", params.staffRole);
  if (params.accountStatus) qs.set("status", params.accountStatus);
  else if (params.suspendedOnly) qs.set("suspended", "1");
  if (params.emailVerified === true) qs.set("emailVerified", "1");
  else if (params.emailVerified === false) qs.set("emailVerified", "0");
  if (params.emailStatus) qs.set("emailStatus", params.emailStatus);
  if (params.kycStatuses?.length) qs.set("kycStatuses", params.kycStatuses.join(","));
  else if (params.kycStatus) qs.set("kycStatus", params.kycStatus);
  if (params.persona) qs.set("persona", params.persona);
  if (params.twoFactorEnabled === true) qs.set("twoFactor", "1");
  else if (params.twoFactorEnabled === false) qs.set("twoFactor", "0");
  if (params.deletionRequestedOnly) qs.set("deletionRequested", "1");
  if (params.hasMobile === true) qs.set("hasMobile", "1");
  else if (params.hasMobile === false) qs.set("hasMobile", "0");
  if (params.createdFrom) qs.set("createdFrom", params.createdFrom);
  if (params.createdTo) qs.set("createdTo", params.createdTo);
  if (params.kycVerifiedFrom) qs.set("kycVerifiedFrom", params.kycVerifiedFrom);
  if (params.kycVerifiedTo) qs.set("kycVerifiedTo", params.kycVerifiedTo);
  if (params.lastActiveFrom) qs.set("lastActiveFrom", params.lastActiveFrom);
  if (params.lastActiveTo) qs.set("lastActiveTo", params.lastActiveTo);
  if (params.sort) qs.set("sort", params.sort);
  const res = await authedServerFetch(`/admin/users?${qs.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to load users: ${res.status}`);
  }
  const json = (await res.json()) as { data: { rows: AdminUserRow[]; total: number } };
  return json.data;
}

export type AdminUserDetailPayload = AdminUserRow & {
  suspendedReason: string | null;
  dateOfBirth: string | null;
  emailStatusChangedAt: string | null;
  pendingNewEmail: string | null;
  emailChangeExpiresAt: string | null;
  currentKycSessionId: string | null;
};

export type AdminKycSessionRow = {
  id: string;
  provider: string;
  providerSessionId: string;
  providerAttemptId: string | null;
  status: string;
  verifiedFirstName: string | null;
  verifiedLastName: string | null;
  verifiedDateOfBirth: string | null;
  verifiedIdNumberLast4: string | null;
  verifiedIdCountry: string | null;
  verifiedIdType: string | null;
  verifiedIdExpiry: string | null;
  verifiedGender: string | null;
  verifiedNationality: string | null;
  verifiedCitizenship: string | null;
  verifiedPlaceOfBirth: string | null;
  verifiedYearOfBirth: string | null;
  verifiedIdNumber: string | null;
  verifiedDocState: string | null;
  verifiedIdValidFrom: string | null;
  decisionRiskScore: string | null;
  decisionIpCountry: string | null;
  createdAt: string;
  decisionAt: string | null;
};

export async function getAdminUserKycSessions(userId: string): Promise<AdminKycSessionRow[]> {
  const res = await authedServerFetch(`/admin/users/${encodeURIComponent(userId)}/kyc-sessions`);
  if (!res.ok) {
    throw new Error(`Failed to load KYC sessions: ${res.status}`);
  }
  const body = (await res.json()) as { data: AdminKycSessionRow[] };
  return body.data;
}

export async function getAdminUserById(id: string): Promise<AdminUserDetailPayload | null> {
  const res = await authedServerFetch(`/admin/users/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load user: ${res.status}`);
  const body = (await res.json()) as { data: AdminUserDetailPayload };
  return body.data;
}

export type AdminUserLookupRow = {
  id: string;
  name: string;
  email: string;
};

export async function getAdminUsersByIds(ids: string[]): Promise<AdminUserLookupRow[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];
  const qs = new URLSearchParams({ ids: unique.join(",") });
  const res = await authedServerFetch(`/admin/users/lookup?${qs.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to load users: ${res.status}`);
  const body = (await res.json()) as {
    data: { id: string; name: string; email: string }[];
  };
  return body.data.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
  }));
}

export type AdminUserActivityEntry = {
  id: string;
  createdAt: string;
  expiresAt: string;
  ipAddress: string | null;
};

export async function getAdminUserActivity(
  userId: string,
  limit = 20,
): Promise<AdminUserActivityEntry[]> {
  const qs = new URLSearchParams({ limit: String(limit) });
  const res = await authedServerFetch(
    `/admin/users/${encodeURIComponent(userId)}/activity?${qs.toString()}`,
  );
  if (!res.ok) {
    throw new Error(`Failed to load user activity: ${res.status}`);
  }
  const body = (await res.json()) as { data: AdminUserActivityEntry[] };
  return body.data;
}

function parseLegalEntityFromAdminApi(raw: Record<string, unknown>): LegalEntity {
  const status =
    typeof raw.status === "string" && legalEntityStatuses.includes(raw.status as LegalEntityStatus)
      ? (raw.status as LegalEntityStatus)
      : "lead";
  const kind =
    typeof raw.kind === "string" &&
    legalEntityKinds.includes(raw.kind as "individual" | "organisation")
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
    stripeConnectDisabledReason:
      raw.stripeConnectDisabledReason == null ? null : String(raw.stripeConnectDisabledReason),
    xeroContactId: raw.xeroContactId == null ? null : String(raw.xeroContactId),
    stripeCustomerId: raw.stripeCustomerId == null ? null : String(raw.stripeCustomerId),
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

export type LotWithdrawalRequestTask = {
  id: string;
  kind: string;
  status: string;
  targetLotId: string | null;
  payload: Record<string, unknown>;
  createdAt: Date;
};

export async function getLotWithdrawalRequests(): Promise<LotWithdrawalRequestTask[]> {
  const res = await authedServerFetch("/admin/lots/withdrawal-requests");
  if (!res.ok) throw new Error(`Failed to load withdrawal requests: ${res.status}`);
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

export type AdminDomainEventRow = {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  actorUserId: string | null;
  actingLegalEntityId: string | null;
  occurredAt: Date;
};

function parseAdminDomainEventRows(body: {
  data: Record<string, unknown>[];
}): AdminDomainEventRow[] {
  return body.data.map((row) => ({
    id: String(row.id ?? ""),
    aggregateType: String(row.aggregateType ?? ""),
    aggregateId: String(row.aggregateId ?? ""),
    eventType: String(row.eventType ?? ""),
    payload: (row.payload as Record<string, unknown>) ?? {},
    actorUserId: row.actorUserId == null ? null : String(row.actorUserId),
    actingLegalEntityId: row.actingLegalEntityId == null ? null : String(row.actingLegalEntityId),
    occurredAt: new Date(String(row.occurredAt ?? "")),
  }));
}

/** Finance admin + platform admin: Stripe dispute-related domain events only. */
export async function getAdminFinanceDisputeDomainEvents(params: {
  limit?: number;
  offset?: number;
}): Promise<AdminDomainEventRow[]> {
  const qs = new URLSearchParams();
  qs.set("limit", String(params.limit ?? 200));
  qs.set("offset", String(params.offset ?? 0));
  const res = await authedServerFetch(`/admin/finance/dispute-domain-events?${qs.toString()}`);
  if (!res.ok) throw new Error(`Failed to load dispute domain events: ${res.status}`);
  const body = (await res.json()) as { data: Record<string, unknown>[] };
  return parseAdminDomainEventRows(body);
}

/** Domain events for a single aggregate (lot, sale, etc.). */
export async function getAdminDomainEventsForAggregate(params: {
  aggregateType: string;
  aggregateId: string;
  limit?: number;
  offset?: number;
}): Promise<AdminDomainEventRow[]> {
  const qs = new URLSearchParams();
  qs.set("aggregateType", params.aggregateType);
  qs.set("aggregateId", params.aggregateId);
  qs.set("limit", String(params.limit ?? 100));
  qs.set("offset", String(params.offset ?? 0));
  const res = await authedServerFetch(`/admin/audit/domain-events?${qs.toString()}`);
  if (!res.ok) throw new Error(`Failed to load domain events: ${res.status}`);
  const body = (await res.json()) as { data: Record<string, unknown>[] };
  return parseAdminDomainEventRows(body);
}

export type AdminSaleroomSessionRow = {
  id: string;
  saleId: string;
  status: string;
  currentLotId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  clerkUserId: string | null;
  auctioneerUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminSaleroomEventRow = {
  id: string;
  sessionId: string;
  kind: string;
  payload: Record<string, unknown>;
  actorUserId: string | null;
  occurredAt: string;
};

export type AdminSaleroomSessionSnapshot = {
  session: AdminSaleroomSessionRow | null;
  events: AdminSaleroomEventRow[];
};

function parseIsoOrNull(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const s = String(v);
  return s.length > 0 ? s : null;
}

function parseAdminSaleroomSessionSnapshot(raw: unknown): AdminSaleroomSessionSnapshot {
  const o = raw as Record<string, unknown>;
  const sessionRaw = o.session as Record<string, unknown> | null | undefined;
  const session: AdminSaleroomSessionRow | null = sessionRaw
    ? {
        id: String(sessionRaw.id ?? ""),
        saleId: String(sessionRaw.saleId ?? ""),
        status: String(sessionRaw.status ?? ""),
        currentLotId: sessionRaw.currentLotId == null ? null : String(sessionRaw.currentLotId),
        startedAt: parseIsoOrNull(sessionRaw.startedAt),
        endedAt: parseIsoOrNull(sessionRaw.endedAt),
        clerkUserId: sessionRaw.clerkUserId == null ? null : String(sessionRaw.clerkUserId),
        auctioneerUserId:
          sessionRaw.auctioneerUserId == null ? null : String(sessionRaw.auctioneerUserId),
        createdAt: parseIsoOrNull(sessionRaw.createdAt) ?? "",
        updatedAt: parseIsoOrNull(sessionRaw.updatedAt) ?? "",
      }
    : null;
  const eventsRaw = Array.isArray(o.events) ? o.events : [];
  const events: AdminSaleroomEventRow[] = eventsRaw.map((e) => {
    const row = e as Record<string, unknown>;
    return {
      id: String(row.id ?? ""),
      sessionId: String(row.sessionId ?? ""),
      kind: String(row.kind ?? ""),
      payload: (row.payload as Record<string, unknown>) ?? {},
      actorUserId: row.actorUserId == null ? null : String(row.actorUserId),
      occurredAt: parseIsoOrNull(row.occurredAt) ?? "",
    };
  });
  return { session, events };
}

export async function getAdminSaleroomSession(
  saleId: string,
): Promise<AdminSaleroomSessionSnapshot> {
  const res = await authedServerFetch(
    `/admin/sales/${encodeURIComponent(saleId)}/saleroom/session`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Failed to load saleroom session: ${res.status}`);
  const body = (await res.json()) as { data: unknown };
  return parseAdminSaleroomSessionSnapshot(body.data);
}
