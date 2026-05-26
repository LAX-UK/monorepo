import {
  firstString,
  parseListSearchParams,
  sliceAdminListWindow,
} from "@/lib/admin/admin-list-params";
import type { AdminListQueryBase, IAdminListController } from "@/lib/admin/i-admin-list-controller";
import type { ListLotsParams } from "@/lib/data/contracts";
import {
  type AdminConditionReportRequestRow,
  type AdminConveyorPipelineRow,
  type AdminDomainEventRow,
  type AdminPayoutRow,
  type AdminSaleListRow,
  type GetAdminArtistListParams,
  getAdminArtistList,
  getAdminCategoryList,
  getAdminConditionReportRequests,
  getAdminConveyorPipeline,
  getAdminFinanceDisputeDomainEvents,
  getAdminLotFulfilmentList,
  getAdminLotList,
  getAdminLotsByIds,
  getAdminPaymentList,
  getAdminPayoutList,
  getAdminSalesList,
  getAdminUserList,
} from "@/lib/data/http/admin.server";
import {
  type AdminInvitationSummary,
  getAdminInvitations,
} from "@/lib/data/http/invitations.server";
import { getAdminSubmissions } from "@/lib/data/http/submissions.server";
import {
  type AdminPaymentTableRow,
  buildAdminPaymentTableRows,
  filterPaymentTableRowsByStatus,
} from "@/lib/data/view-models/admin-payments-table.vm";
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
    return { ...base, lifecycle: life, status, delivery, limit: Math.min(100, base.limit) };
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
    } = {
      limit: q.limit,
      offset: q.offset,
    };
    if (q.status !== undefined) p.status = q.status;
    else if (settlementStatus) p.status = "ended";
    if (q.q !== undefined && q.q !== "") p.q = q.q;
    if (q.delivery) p.deliveryMode = q.delivery;
    if (settlementStatus) p.settlementStatus = settlementStatus;
    const rows = await getAdminSalesList(p);
    return { rows, offset: q.offset, limit: q.limit };
  },
};

export type UsersListQuery = AdminListQueryBase & {
  role?: string | undefined;
  staffRole?: string | undefined;
  suspendedOnly?: boolean | undefined;
};

export const usersListController: IAdminListController<
  Awaited<ReturnType<typeof getAdminUserList>>["rows"][number],
  UsersListQuery
> = {
  id: "users",
  parseQuery(sp) {
    const base = parseListSearchParams(sp);
    const role = firstString(sp.role);
    const staffRole = firstString(sp.staffRole);
    const suspendedOnly = firstString(sp.suspended) === "1";
    return { ...base, role, staffRole, suspendedOnly, limit: Math.min(100, base.limit) };
  },
  async fetch(q) {
    const p: Parameters<typeof getAdminUserList>[0] = {
      limit: q.limit,
      offset: q.offset,
    };
    if (q.q !== undefined && q.q !== "") p.q = q.q;
    if (q.role !== undefined && q.role !== "") p.role = q.role;
    if (q.staffRole !== undefined && q.staffRole !== "") p.staffRole = q.staffRole;
    if (q.suspendedOnly) p.suspendedOnly = true;
    const data = await getAdminUserList(p);
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
    const qRaw = base.q?.trim();
    const q = qRaw ? qRaw.slice(0, 200) : undefined;
    const limit = viewPipeline ? 200 : Math.min(200, base.limit);
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
    };
  },
  async fetch(q) {
    const p: ListLotsParams = {
      limit: q.limit,
      offset: q.offset,
    };
    if (q.status !== undefined) p.status = q.status;
    if (q.artistId !== undefined && q.artistId !== "") p.artistId = q.artistId;
    if (q.saleId !== undefined && q.saleId !== "") p.saleId = q.saleId;
    if (q.categoryId !== undefined && q.categoryId !== "") p.categoryId = q.categoryId;
    if (q.sort !== undefined) p.sort = q.sort;
    if (q.q !== undefined && q.q !== "") p.q = q.q;
    const rows = await getAdminLotList(p);
    return { rows, offset: q.offset, limit: q.limit };
  },
};

export type ArtistsListQuery = AdminListQueryBase & {
  includeArchived?: boolean | undefined;
  archivedOnly?: boolean | undefined;
  kind?: string | undefined;
  kinds?: string | undefined;
  status?: string | undefined;
  ownerUserId?: string | undefined;
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
};

export const submissionsListController: IAdminListController<ItemSubmission, SubmissionsListQuery> =
  {
    id: "submissions",
    parseQuery(sp) {
      const base = parseListSearchParams(sp);
      const qt = firstString(sp.queue);
      const queueAllowed: SubmissionDecisionQueue[] = ["awaiting", "accepted", "rejected"];
      const queueExplicit =
        qt && (queueAllowed as readonly string[]).includes(qt)
          ? (qt as SubmissionDecisionQueue)
          : undefined;
      const queue = queueExplicit ?? ("awaiting" as SubmissionDecisionQueue);
      const limit = base.limit === 50 ? 100 : Math.min(100, base.limit);
      const categoryId = firstString(sp.categoryId);
      return {
        ...base,
        queue,
        limit,
        ...(categoryId ? { categoryId } : {}),
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
      const allRows = buildAdminPaymentTableRows(payments, lots, fulfilmentRows);
      let filtered = filterPaymentTableRowsByStatus(allRows, q.status);
      const needle = q.q?.trim().toLowerCase();
      if (needle) {
        filtered = filtered.filter(
          (r) =>
            r.lotTitle.toLowerCase().includes(needle) ||
            r.buyerId.toLowerCase().includes(needle) ||
            r.id.toLowerCase().includes(needle) ||
            (r.fulfilmentStatus?.toLowerCase().includes(needle) ?? false),
        );
      }
      const { rows, total } = sliceAdminListWindow(filtered, q.offset, q.limit);
      return {
        rows,
        rowsForSummary: allRows,
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
    const all = await getAdminInvitations();
    const { rows, total } = sliceAdminListWindow(all, q.offset, q.limit);
    return { rows, offset: q.offset, limit: q.limit, total };
  },
};

export const disputesDomainEventsListController: IAdminListController<
  AdminDomainEventRow,
  AdminListQueryBase
> = {
  id: "disputes-domain-events",
  parseQuery(sp) {
    const base = parseListSearchParams(sp);
    const limit = base.limit === 50 ? 200 : Math.min(500, base.limit);
    return { ...base, limit };
  },
  async fetch(q) {
    const rows = await getAdminFinanceDisputeDomainEvents({
      limit: q.limit,
      offset: q.offset,
    });
    return { rows, offset: q.offset, limit: q.limit };
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
        ? lens === "open"
          ? undefined
          : lens
        : undefined;
    const { items, total, limit, offset } = await getAdminConditionReportRequests({
      ...(status ? { status } : {}),
      limit: q.limit,
      offset: q.offset,
    });
    const rows =
      lens === "open"
        ? items.filter((r) => r.status === "pending" || r.status === "in_progress")
        : items;
    return { rows, total: lens === "open" ? rows.length : total, limit, offset };
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
    const limit = base.limit === 50 ? 100 : Math.min(200, base.limit);
    return { ...base, status, legalEntityId, limit };
  },
  async fetch(q) {
    const listParams = {
      limit: q.limit,
      offset: q.offset,
      ...(q.status ? { status: q.status } : {}),
      ...(q.legalEntityId ? { legalEntityId: q.legalEntityId } : {}),
    };
    const rows = await getAdminPayoutList(listParams);

    const needsDedicatedSummary = q.offset > 0 || q.limit !== 100;
    const rowsForSummary = needsDedicatedSummary
      ? await getAdminPayoutList({
          limit: 100,
          offset: 0,
          ...(q.status ? { status: q.status } : {}),
          ...(q.legalEntityId ? { legalEntityId: q.legalEntityId } : {}),
        })
      : rows;

    return { rows, offset: q.offset, limit: q.limit, rowsForSummary };
  },
};

export { paymentStatusesForChip };
