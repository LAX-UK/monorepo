import {
  firstString,
  parseListSearchParams,
  sliceAdminListWindow,
} from "@/lib/admin/admin-list-params";
import type { AdminListQueryBase, IAdminListController } from "@/lib/admin/i-admin-list-controller";
import {
  type LegalEntityListFilters,
  parseLegalEntityListFilters,
} from "@/lib/admin/legal-entity-list-query";
import { type UsersListFilters, parseUsersListFilters } from "@/lib/admin/users-list-query";
import type { ListLotsParams } from "@/lib/data/contracts";
import {
  type AdminConditionReportRequestRow,
  type AdminConveyorPipelineRow,
  type AdminPayoutRow,
  type AdminSaleListRow,
  type GetAdminArtistListParams,
  getAdminArtistList,
  getAdminCategoryList,
  getAdminConditionReportRequests,
  getAdminConveyorPipeline,
  getAdminDisputeCases,
  getAdminLegalEntityList,
  getAdminLotFulfilmentList,
  getAdminLotList,
  getAdminLotsByIds,
  getAdminPaymentList,
  getAdminPayoutList,
  getAdminSalesList,
  getAdminUserList,
  getAdminUsersByIds,
} from "@/lib/data/http/admin.server";
import {
  getAdminAmlScreeningsPending,
  getAdminSourceOfFundsPending,
} from "@/lib/data/http/compliance.server";
import {
  type AdminInvitationSummary,
  getAdminInvitationsPage,
} from "@/lib/data/http/invitations.server";
import { getAdminSubmissions } from "@/lib/data/http/submissions.server";
import {
  type AdminAmlTableRow,
  buildAdminAmlTableRows,
} from "@/lib/data/view-models/admin-aml-table.vm";
import {
  type AdminDisputeTableRow,
  buildAdminDisputeTableRows,
} from "@/lib/data/view-models/admin-disputes-table.vm";
import {
  type AdminPaymentTableRow,
  buildAdminPaymentTableRows,
  filterPaymentTableRowsByStatus,
} from "@/lib/data/view-models/admin-payments-table.vm";
import {
  type AdminSofTableRow,
  buildAdminSofTableRows,
} from "@/lib/data/view-models/admin-sof-table.vm";
import type {
  AdminArtistListRow,
  AdminCategory,
  ItemSubmission,
  LotStatus,
  PaymentStatus,
  PayoutStatus,
  SaleStatus,
} from "@auction/types";
import { payoutStatuses } from "@auction/types";

const saleStatuses: SaleStatus[] = ["draft", "scheduled", "active", "ended", "cancelled"];

export type SaleLifecycleSlug = "upcoming" | "live" | "closed" | "settled";

export type SalesListQuery = AdminListQueryBase & {
  status?: SaleStatus | undefined;
  /** Mutually exclusive with raw `status` for URL bookmarking — derived into `status` for fetch */
  lifecycle?: SaleLifecycleSlug | undefined;
  /** Server-side filter — online | onsite */
  delivery?: "online" | "onsite" | undefined;
  needsSetup?: boolean | undefined;
};

const saleLifecycleStatuses: Partial<Record<SaleLifecycleSlug, SaleStatus>> = {
  upcoming: "scheduled",
  live: "active",
  closed: "ended",
  settled: "ended",
};

export const salesListController: IAdminListController<AdminSaleListRow, SalesListQuery> = {
  id: "sales",
  parseQuery(sp) {
    const base = parseListSearchParams(sp);
    const lifeRaw = firstString(sp.lifecycle)?.trim()?.toLowerCase();
    const life =
      lifeRaw && ["upcoming", "live", "closed", "settled"].includes(lifeRaw as SaleLifecycleSlug)
        ? (lifeRaw as SaleLifecycleSlug)
        : undefined;
    const lifecycleStatus = life ? saleLifecycleStatuses[life] : undefined;
    const st = firstString(sp.status);
    const explicitStatus =
      lifecycleStatus !== undefined
        ? undefined
        : st && st !== "all" && (saleStatuses as readonly string[]).includes(st)
          ? (st as SaleStatus)
          : undefined;
    const status = lifecycleStatus ?? explicitStatus;
    const deliveryRaw = firstString(sp.delivery)?.trim()?.toLowerCase();
    const delivery =
      deliveryRaw === "online" || deliveryRaw === "onsite"
        ? (deliveryRaw as "online" | "onsite")
        : undefined;
    const lensRaw = firstString(sp.lens)?.trim()?.toLowerCase();
    const needsSetup = lensRaw === "setup" || firstString(sp.needsSetup) === "1";
    return {
      ...base,
      lifecycle: life,
      status: needsSetup ? "draft" : status,
      delivery,
      needsSetup: needsSetup || undefined,
      limit: Math.min(100, base.limit),
    };
  },
  async fetch(q) {
    const life = q.lifecycle;
    const settlementStatus =
      life === "closed"
        ? ("unsettled" as const)
        : life === "settled"
          ? ("settled" as const)
          : undefined;

    const p: {
      limit: number;
      offset: number;
      status?: SaleStatus;
      q?: string;
      deliveryMode?: "online" | "onsite";
      settlementStatus?: "settled" | "unsettled";
      sort?: "createdDesc" | "startAsc";
      needsSetup?: boolean;
    } = {
      limit: q.limit,
      offset: q.offset,
    };
    if (q.status !== undefined) p.status = q.status;
    else if (settlementStatus) p.status = "ended";
    if (q.q !== undefined && q.q !== "") p.q = q.q;
    if (q.delivery) p.deliveryMode = q.delivery;
    if (settlementStatus) p.settlementStatus = settlementStatus;
    if (q.sort) p.sort = q.sort as "createdDesc" | "startAsc";
    if (q.needsSetup) p.needsSetup = true;
    const fetchLimit = q.limit + 1;
    const rows = await getAdminSalesList({ ...p, limit: fetchLimit });
    const hasNextPage = rows.length > q.limit;
    const pageRows = hasNextPage ? rows.slice(0, q.limit) : rows;
    return { rows: pageRows, offset: q.offset, limit: q.limit, hasNextPage };
  },
};

export type { SalesListExportFilters } from "./sales-list-export-filters";
export { salesListExportFilters } from "./sales-list-export-filters";

export type UsersListQuery = AdminListQueryBase & UsersListFilters;

export const usersListController: IAdminListController<
  Awaited<ReturnType<typeof getAdminUserList>>["rows"][number],
  UsersListQuery
> = {
  id: "users",
  parseQuery(sp) {
    const base = parseListSearchParams(sp);
    const filters = parseUsersListFilters(sp);
    const role = firstString(sp.role);
    const staffRole = firstString(sp.staffRole);
    const query: UsersListQuery = {
      limit: Math.min(100, base.limit),
      offset: base.offset,
      ...filters,
    };
    if (filters.q) query.q = filters.q;
    else if (base.q) query.q = base.q;
    if (filters.sort) query.sort = filters.sort;
    if (role) query.role = role;
    if (staffRole) query.staffRole = staffRole;
    return query;
  },
  async fetch(q) {
    const data = await getAdminUserList({
      limit: q.limit,
      offset: q.offset,
      ...(q.q ? { q: q.q } : {}),
      ...(q.role ? { role: q.role } : {}),
      ...(q.staffRole ? { staffRole: q.staffRole } : {}),
      ...(q.accountStatus ? { accountStatus: q.accountStatus } : {}),
      ...(q.suspendedOnly ? { suspendedOnly: true } : {}),
      ...(q.emailVerified !== undefined ? { emailVerified: q.emailVerified } : {}),
      ...(q.kycStatuses?.length ? { kycStatuses: q.kycStatuses } : {}),
      ...(q.kycStatus ? { kycStatus: q.kycStatus } : {}),
      ...(q.persona ? { persona: q.persona } : {}),
      ...(q.twoFactorEnabled !== undefined ? { twoFactorEnabled: q.twoFactorEnabled } : {}),
      ...(q.deletionRequestedOnly ? { deletionRequestedOnly: true } : {}),
      ...(q.hasMobile !== undefined ? { hasMobile: q.hasMobile } : {}),
      ...(q.createdFrom ? { createdFrom: q.createdFrom } : {}),
      ...(q.createdTo ? { createdTo: q.createdTo } : {}),
      ...(q.kycVerifiedFrom ? { kycVerifiedFrom: q.kycVerifiedFrom } : {}),
      ...(q.kycVerifiedTo ? { kycVerifiedTo: q.kycVerifiedTo } : {}),
      ...(q.lastActiveFrom ? { lastActiveFrom: q.lastActiveFrom } : {}),
      ...(q.lastActiveTo ? { lastActiveTo: q.lastActiveTo } : {}),
      ...(q.sort ? { sort: q.sort } : {}),
    });
    return { rows: data.rows, total: data.total, offset: q.offset, limit: q.limit };
  },
};

export type LotsListQuery = AdminListQueryBase & {
  status?: LotStatus | undefined;
  artistId?: string | undefined;
  saleId?: string | undefined;
  categoryId?: string | undefined;
  sort?: ListLotsParams["sort"] | undefined;
  q?: string | undefined;
  viewPipeline?: boolean | undefined;
  needsPhotos?: boolean | undefined;
};

export const lotsListController: IAdminListController<
  Awaited<ReturnType<typeof getAdminLotList>>[number],
  LotsListQuery
> = {
  id: "lots",
  parseQuery(sp) {
    const base = parseListSearchParams(sp);
    const viewPipeline = firstString(sp.view) === "pipeline";
    const st = firstString(sp.status);
    const status = st && st !== "all" ? (st as LotStatus) : undefined;
    const artistId = firstString(sp.artistId);
    const saleId = firstString(sp.saleId);
    const categoryId = firstString(sp.categoryId);
    const sort = firstString(sp.sort) as ListLotsParams["sort"] | undefined;
    const needsPhotos = firstString(sp.needsPhotos) === "1";
    const qRaw = base.q?.trim();
    const q = qRaw ? qRaw.slice(0, 200) : undefined;
    /** Pipeline is a single-page board (max 200 rows). Cursor-based server pipeline is deferred until lists routinely exceed this cap. */
    const PIPELINE_LOT_CAP = 200;
    const limit = viewPipeline ? PIPELINE_LOT_CAP : Math.min(200, base.limit);
    return {
      ...base,
      limit,
      viewPipeline,
      status,
      artistId,
      saleId,
      categoryId,
      sort,
      q,
      needsPhotos,
    };
  },
  async fetch(q) {
    const fetchLimit = q.limit + 1;
    const p: ListLotsParams = {
      limit: fetchLimit,
      offset: q.offset,
    };
    if (q.status !== undefined) p.status = q.status;
    if (q.artistId !== undefined && q.artistId !== "") p.artistId = q.artistId;
    if (q.saleId !== undefined && q.saleId !== "") p.saleId = q.saleId;
    if (q.categoryId !== undefined && q.categoryId !== "") p.categoryId = q.categoryId;
    if (q.sort !== undefined) p.sort = q.sort;
    if (q.q !== undefined && q.q !== "") p.q = q.q;
    if (q.needsPhotos) p.needsPhotos = true;
    const rows = await getAdminLotList(p);
    if (q.viewPipeline) {
      const hasNextPage = rows.length > q.limit;
      const pageRows = hasNextPage ? rows.slice(0, q.limit) : rows;
      return { rows: pageRows, offset: q.offset, limit: q.limit, hasNextPage };
    }
    const hasNextPage = rows.length > q.limit;
    const pageRows = hasNextPage ? rows.slice(0, q.limit) : rows;
    return { rows: pageRows, offset: q.offset, limit: q.limit, hasNextPage };
  },
};

export type ArtistsListQuery = AdminListQueryBase & {
  includeArchived?: boolean | undefined;
  archivedOnly?: boolean | undefined;
  kind?: string | undefined;
  kinds?: string | undefined;
  status?: string | undefined;
  ownerUserId?: string | undefined;
  categoryId?: string | undefined;
  country?: string | undefined;
  featured?: boolean | undefined;
  verified?: boolean | undefined;
  linked?: "any" | "yes" | "no" | undefined;
  sort?: string | undefined;
};

export const artistsListController: IAdminListController<AdminArtistListRow, ArtistsListQuery> = {
  id: "artists",
  parseQuery(sp) {
    const base = parseListSearchParams(sp);
    const includeArchived = firstString(sp.includeArchived) === "true";
    const archivedOnly = firstString(sp.archivedOnly) === "true";
    const kind = firstString(sp.kind);
    const kinds = firstString(sp.kinds);
    const status = firstString(sp.status);
    const ownerUserId = firstString(sp.ownerUserId);
    const categoryId = firstString(sp.categoryId);
    const country = firstString(sp.country);
    const featured = firstString(sp.featured) === "true" || firstString(sp.featured) === "1";
    const verified = firstString(sp.verified) === "true" || firstString(sp.verified) === "1";
    const linkedRaw = firstString(sp.linked);
    const linked = linkedRaw === "yes" || linkedRaw === "no" ? linkedRaw : ("any" as const);
    const sort = firstString(sp.sort)?.trim() || undefined;
    return {
      ...base,
      includeArchived,
      archivedOnly,
      kind,
      kinds,
      status,
      ownerUserId,
      categoryId,
      country,
      featured: featured || undefined,
      verified: verified || undefined,
      linked,
      sort,
      limit: Math.min(200, base.limit),
    };
  },
  async fetch(q) {
    const p: GetAdminArtistListParams = {
      limit: q.limit,
      offset: q.offset,
    };
    if (q.sort) p.sort = q.sort;
    if (q.linked === "yes" || q.linked === "no") p.linked = q.linked;
    if (q.q !== undefined && q.q !== "") p.q = q.q;
    if (q.includeArchived) p.includeArchived = true;
    if (q.archivedOnly) p.archivedOnly = true;
    if (q.kind !== undefined && q.kind !== "") p.kind = q.kind;
    if (q.kinds !== undefined && q.kinds !== "") p.kinds = q.kinds;
    if (q.status !== undefined && q.status !== "") p.status = q.status;
    if (q.ownerUserId !== undefined && q.ownerUserId !== "") p.ownerUserId = q.ownerUserId;
    if (q.categoryId !== undefined && q.categoryId !== "") p.categoryId = q.categoryId;
    if (q.country !== undefined && q.country !== "") p.country = q.country;
    if (q.featured) p.featured = true;
    if (q.verified) p.verified = true;
    const { rows, total } = await getAdminArtistList(p);
    return { rows, offset: q.offset, limit: q.limit, total };
  },
};

export type SubmissionDecisionQueue = "awaiting" | "accepted" | "rejected";

export type SubmissionsListQuery = AdminListQueryBase & {
  /** Decision-queue tabs. Maps to grouped statuses via API `queue`. */
  queue?: SubmissionDecisionQueue | undefined;
  categoryId?: string | undefined;
  /** When true, only rows with quality warnings or missing required fields. */
  qualityGaps?: boolean | undefined;
  /** When true, only submissions assigned to the signed-in staff member. */
  assignedToMe?: boolean | undefined;
  sort?: "sla" | undefined;
};

export const submissionsListController: IAdminListController<ItemSubmission, SubmissionsListQuery> =
  {
    id: "submissions",
    parseQuery(sp) {
      const { sort: _baseSort, ...base } = parseListSearchParams(sp);
      const qt = firstString(sp.queue);
      const queueAllowed: SubmissionDecisionQueue[] = ["awaiting", "accepted", "rejected"];
      const queueExplicit =
        qt && (queueAllowed as readonly string[]).includes(qt)
          ? (qt as SubmissionDecisionQueue)
          : undefined;
      const queue = queueExplicit ?? ("awaiting" as SubmissionDecisionQueue);
      const limit = base.limit === 50 ? 100 : Math.min(100, base.limit);
      const categoryId = firstString(sp.categoryId);
      const qualityGaps = firstString(sp.qualityGaps) === "1";
      const assignedToMe = firstString(sp.assignedTo) === "me";
      const sortSla = firstString(sp.sort) === "sla";
      return {
        ...base,
        queue,
        limit,
        ...(categoryId ? { categoryId } : {}),
        ...(qualityGaps ? { qualityGaps: true } : {}),
        ...(assignedToMe ? { assignedToMe: true } : {}),
        ...(sortSla ? { sort: "sla" as const } : {}),
      };
    },
    async fetch(q) {
      const p: Parameters<typeof getAdminSubmissions>[0] = {
        limit: q.limit,
        offset: q.offset,
        queue: q.queue ?? "awaiting",
      };
      if (q.q !== undefined && q.q !== "") p.q = q.q;
      if (q.categoryId) p.categoryId = q.categoryId;
      if (q.qualityGaps) p.qualityGaps = true;
      if (q.assignedToMe) p.assignedTo = "me";
      if (q.sort) p.sort = q.sort;
      const { rows, total } = await getAdminSubmissions(p);
      return { rows, offset: q.offset, limit: q.limit, total };
    },
  };

const paymentStatusesForChip: (PaymentStatus | "all")[] = [
  "all",
  "pending",
  "authorized",
  "captured",
  "refunded",
];

function isPaymentListStatus(s: string): s is PaymentStatus {
  return (
    s === "pending" ||
    s === "authorized" ||
    s === "captured" ||
    s === "refunded" ||
    s === "requires_manual_review"
  );
}

export type PaymentsListQuery = AdminListQueryBase & {
  status?: PaymentStatus | undefined;
};

export const paymentsListController: IAdminListController<AdminPaymentTableRow, PaymentsListQuery> =
  {
    id: "payments",
    parseQuery(sp) {
      const base = parseListSearchParams(sp);
      const st = firstString(sp.status);
      const status =
        st && st !== "all" && isPaymentListStatus(st) ? (st as PaymentStatus) : undefined;
      return { ...base, status, limit: Math.min(200, base.limit) };
    },
    async fetch(q) {
      const [payments, fulfilmentRows] = await Promise.all([
        getAdminPaymentList(),
        getAdminLotFulfilmentList().catch(() => []),
      ]);
      const lots = await getAdminLotsByIds(payments.map((p) => p.lotId));
      let allRows = buildAdminPaymentTableRows(payments, lots, fulfilmentRows);
      const buyerIds = [...new Set(allRows.map((row) => row.buyerId).filter(Boolean))];
      const buyers = await getAdminUsersByIds(buyerIds).catch(() => []);
      const buyerLabels = new Map(buyers.map((b) => [b.id, b.name || b.email || null]));
      allRows = allRows.map((row) => ({
        ...row,
        buyerLabel: buyerLabels.get(row.buyerId) ?? null,
      }));
      let filtered = filterPaymentTableRowsByStatus(allRows, q.status);
      const needle = q.q?.trim().toLowerCase();
      if (needle) {
        filtered = filtered.filter(
          (r) =>
            r.lotTitle.toLowerCase().includes(needle) ||
            r.buyerId.toLowerCase().includes(needle) ||
            (r.buyerLabel?.toLowerCase().includes(needle) ?? false) ||
            r.id.toLowerCase().includes(needle) ||
            (r.fulfilmentStatus?.toLowerCase().includes(needle) ?? false),
        );
      }
      const { rows, total } = sliceAdminListWindow(filtered, q.offset, q.limit);
      return {
        rows,
        rowsForSummary: filtered,
        total,
        offset: q.offset,
        limit: q.limit,
      };
    },
  };

export const invitationsListController: IAdminListController<
  AdminInvitationSummary,
  AdminListQueryBase
> = {
  id: "invitations",
  parseQuery(sp) {
    const base = parseListSearchParams(sp);
    return { ...base, limit: Math.min(200, base.limit) };
  },
  async fetch(q) {
    const { rows, total } = await getAdminInvitationsPage({ offset: q.offset, limit: q.limit });
    return { rows, offset: q.offset, limit: q.limit, total };
  },
};

export type DisputesListQuery = AdminListQueryBase & {
  status?: "open" | "under_review" | "closed" | undefined;
};

export const disputesListController: IAdminListController<AdminDisputeTableRow, DisputesListQuery> =
  {
    id: "disputes",
    parseQuery(sp) {
      const base = parseListSearchParams(sp);
      const statusRaw = firstString(sp.status);
      const status =
        statusRaw === "open" || statusRaw === "under_review" || statusRaw === "closed"
          ? statusRaw
          : undefined;
      return { ...base, limit: Math.min(200, base.limit), status };
    },
    async fetch(q) {
      const result = await getAdminDisputeCases({
        limit: q.limit,
        offset: q.offset,
        ...(q.status !== undefined ? { status: q.status } : {}),
      });
      return {
        rows: buildAdminDisputeTableRows(result.rows),
        offset: q.offset,
        limit: q.limit,
        hasNextPage: result.hasNextPage,
        summary: result.summary,
      };
    },
  };

export type CategoriesListQuery = AdminListQueryBase & {
  includeArchived?: boolean | undefined;
};

export const categoriesListController: IAdminListController<AdminCategory, CategoriesListQuery> = {
  id: "categories",
  parseQuery(sp) {
    const base = parseListSearchParams(sp);
    const includeArchived = firstString(sp.includeArchived) === "true";
    return { ...base, includeArchived, limit: Math.min(200, base.limit) };
  },
  async fetch(q) {
    const all = await getAdminCategoryList({
      includeArchived: Boolean(q.includeArchived),
      ...(q.q !== undefined && q.q !== "" ? { q: q.q } : {}),
    });
    const { rows, total } = sliceAdminListWindow(all, q.offset, q.limit);
    return { rows, offset: q.offset, limit: q.limit, total };
  },
};

export const conveyorListController: IAdminListController<
  AdminConveyorPipelineRow,
  AdminListQueryBase
> = {
  id: "conveyor",
  parseQuery(sp) {
    const base = parseListSearchParams(sp);
    const limit = Math.min(500, Math.max(50, base.limit === 50 ? 250 : base.limit));
    return { ...base, limit };
  },
  async fetch(q) {
    const rows = await getAdminConveyorPipeline({ limit: q.limit });
    return { rows, offset: q.offset, limit: q.limit };
  },
};

export type ConditionReportsListQuery = AdminListQueryBase & {
  lens?: "open" | "pending" | "in_progress" | "fulfilled" | "declined";
};

type ConditionReportLens = NonNullable<ConditionReportsListQuery["lens"]>;

function parseConditionReportLens(raw: string | undefined): ConditionReportLens {
  const st = firstString(raw);
  if (st === "pending" || st === "in_progress" || st === "fulfilled" || st === "declined") {
    return st;
  }
  return "open";
}

export const conditionReportsListController: IAdminListController<
  AdminConditionReportRequestRow,
  ConditionReportsListQuery
> = {
  id: "condition-reports",
  parseQuery(sp) {
    const base = parseListSearchParams(sp);
    return {
      ...base,
      limit: Math.min(80, base.limit),
      lens: parseConditionReportLens(firstString(sp.lens)),
    };
  },
  async fetch(q) {
    const lens = q.lens ?? "open";
    const status =
      lens === "open" ||
      lens === "pending" ||
      lens === "in_progress" ||
      lens === "fulfilled" ||
      lens === "declined"
        ? lens
        : undefined;
    const { items, total, limit, offset } = await getAdminConditionReportRequests({
      ...(status ? { status } : {}),
      limit: q.limit,
      offset: q.offset,
    });
    return { rows: items, total, limit, offset };
  },
};

function parsePayoutListStatus(raw: string | undefined): PayoutStatus | undefined {
  const st = firstString(raw);
  if (!st || st === "all") return undefined;
  return (payoutStatuses as readonly string[]).includes(st) ? (st as PayoutStatus) : undefined;
}

export type PayoutsListQuery = AdminListQueryBase & {
  status?: PayoutStatus | undefined;
  legalEntityId?: string | undefined;
};

export const payoutsListController: IAdminListController<AdminPayoutRow, PayoutsListQuery> = {
  id: "payouts",
  parseQuery(sp) {
    const base = parseListSearchParams(sp);
    const status = parsePayoutListStatus(firstString(sp.status));
    const legalEntityId = firstString(sp.legalEntityId)?.trim() || undefined;
    // GET /admin/payouts rejects limit > 100; fetch uses limit+1 for hasNextPage.
    const limit = base.limit === 50 ? 99 : Math.min(99, base.limit);
    return { ...base, status, legalEntityId, limit };
  },
  async fetch(q) {
    const fetchLimit = Math.min(q.limit + 1, 100);
    const listParams = {
      limit: fetchLimit,
      offset: q.offset,
      ...(q.status ? { status: q.status } : {}),
      ...(q.legalEntityId ? { legalEntityId: q.legalEntityId } : {}),
    };
    const fetched = await getAdminPayoutList(listParams);
    const hasNextPage = fetched.length > q.limit;
    const rows = hasNextPage ? fetched.slice(0, q.limit) : fetched;

    const rowsForSummary =
      q.offset > 0
        ? await getAdminPayoutList({
            limit: 100,
            offset: 0,
            ...(q.status ? { status: q.status } : {}),
            ...(q.legalEntityId ? { legalEntityId: q.legalEntityId } : {}),
          })
        : fetched.slice(0, 100);

    return { rows, offset: q.offset, limit: q.limit, rowsForSummary, hasNextPage };
  },
};

export { paymentStatusesForChip };

export type LegalEntitiesListQuery = AdminListQueryBase & LegalEntityListFilters;

export const legalEntitiesListController: IAdminListController<
  Awaited<ReturnType<typeof getAdminLegalEntityList>>["rows"][number],
  LegalEntitiesListQuery
> = {
  id: "legal-entities",
  parseQuery(sp) {
    const base = parseListSearchParams(sp);
    const filters = parseLegalEntityListFilters(sp);
    const query: LegalEntitiesListQuery = {
      limit: Math.min(50, base.limit),
      offset: base.offset,
      ...filters,
    };
    if (filters.q) query.q = filters.q;
    else if (base.q) query.q = base.q;
    return query;
  },
  async fetch(q) {
    const data = await getAdminLegalEntityList({
      limit: q.limit,
      offset: q.offset,
      ...(q.q ? { q: q.q } : {}),
      ...(q.status ? { status: q.status } : {}),
    });
    return { rows: data.rows, total: data.total, offset: q.offset, limit: q.limit };
  },
};

export type VenuesListQuery = AdminListQueryBase & {
  includeArchived?: boolean | undefined;
  legalEntityId?: string | undefined;
};

export const venuesListController: IAdminListController<
  import("@/lib/services/interfaces/admin-venue-service").AdminVenueListRow,
  VenuesListQuery
> = {
  id: "venues",
  parseQuery(sp) {
    const base = parseListSearchParams(sp);
    const includeArchived = firstString(sp.includeArchived) === "true";
    const legalEntityId = firstString(sp.legalEntityId)?.trim() || undefined;
    return { ...base, includeArchived, legalEntityId, limit: Math.min(100, base.limit) };
  },
  async fetch(q) {
    const { getWriteContainer } = await import("@/lib/data/write-container.server");
    const result = await getWriteContainer().adminVenues.list({
      ...(q.legalEntityId ? { legalEntityId: q.legalEntityId } : {}),
      includeArchived: Boolean(q.includeArchived),
      limit: q.limit,
      offset: q.offset,
      ...(q.q?.trim() ? { q: q.q } : {}),
    });
    if (!result.ok) throw new Error(result.message);
    return { rows: result.data.venues, offset: q.offset, limit: q.limit, total: result.data.total };
  },
};

export const amlListController: IAdminListController<AdminAmlTableRow, AdminListQueryBase> = {
  id: "aml",
  parseQuery(sp) {
    const base = parseListSearchParams(sp);
    return { ...base, limit: Math.min(100, base.limit) };
  },
  async fetch(q) {
    const raw = await getAdminAmlScreeningsPending();
    const all = buildAdminAmlTableRows(raw);
    const { rows, total } = sliceAdminListWindow(all, q.offset, q.limit);
    return { rows, offset: q.offset, limit: q.limit, total, rowsForSummary: all };
  },
};

export const sofListController: IAdminListController<AdminSofTableRow, AdminListQueryBase> = {
  id: "sof",
  parseQuery(sp) {
    const base = parseListSearchParams(sp);
    return { ...base, limit: Math.min(100, base.limit) };
  },
  async fetch(q) {
    const raw = await getAdminSourceOfFundsPending();
    const all = buildAdminSofTableRows(raw);
    const { rows, total } = sliceAdminListWindow(all, q.offset, q.limit);
    return { rows, offset: q.offset, limit: q.limit, total, rowsForSummary: all };
  },
};
