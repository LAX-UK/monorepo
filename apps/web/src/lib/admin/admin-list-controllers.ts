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
  type AdminEmailOutboxRow,
  type AdminEmailSuppressionListRow,
  type AdminPayoutRow,
  type AdminSaleListRow,
  type GetAdminArtistListParams,
  getAdminArtistList,
  getAdminCategoryList,
  getAdminConditionReportRequests,
  getAdminConveyorPipeline,
  getAdminDomainEvents,
  getAdminEmailOutbox,
  getAdminEmailSuppressions,
  getAdminFinanceDisputeDomainEvents,
  getAdminLotFulfilmentList,
  getAdminLotList,
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
  ItemSubmissionStatus,
  Lot,
  LotStatus,
  PaymentStatus,
  PayoutStatus,
  SaleStatus,
} from "@auction/types";
import { payoutStatuses } from "@auction/types";

const saleStatuses: SaleStatus[] = ["draft", "scheduled", "active", "ended", "cancelled"];

export type SalesListQuery = AdminListQueryBase & {
  status?: SaleStatus | undefined;
};

export const salesListController: IAdminListController<AdminSaleListRow, SalesListQuery> = {
  id: "sales",
  parseQuery(sp) {
    const base = parseListSearchParams(sp);
    const st = firstString(sp.status);
    const status =
      st && st !== "all" && (saleStatuses as readonly string[]).includes(st)
        ? (st as SaleStatus)
        : undefined;
    return { ...base, status, limit: Math.min(100, base.limit) };
  },
  async fetch(q) {
    const p: { limit: number; offset: number; status?: SaleStatus; q?: string } = {
      limit: q.limit,
      offset: q.offset,
    };
    if (q.status !== undefined) p.status = q.status;
    if (q.q !== undefined && q.q !== "") p.q = q.q;
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

export const lotsListController: IAdminListController<Lot, LotsListQuery> = {
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

export type SubmissionsListQuery = AdminListQueryBase & {
  status?: ItemSubmissionStatus | undefined;
};

export const submissionsListController: IAdminListController<ItemSubmission, SubmissionsListQuery> =
  {
    id: "submissions",
    parseQuery(sp) {
      const base = parseListSearchParams(sp);
      const st = firstString(sp.status);
      const status = st && st !== "all" ? (st as ItemSubmissionStatus) : undefined;
      /** Default page size 100 (parseListSearchParams defaults to 50). */
      const limit = base.limit === 50 ? 100 : Math.min(100, base.limit);
      return { ...base, status, limit };
    },
    async fetch(q) {
      const p: Parameters<typeof getAdminSubmissions>[0] = {
        limit: q.limit,
        offset: q.offset,
      };
      if (q.status !== undefined) p.status = q.status;
      if (q.q !== undefined && q.q !== "") p.q = q.q;
      const { rows, total } = await getAdminSubmissions(p);
      return { rows, offset: q.offset, limit: q.limit, total };
    },
  };

function parseBoundedInt(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (raw === undefined || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

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
      const [payments, lots, fulfilmentRows] = await Promise.all([
        getAdminPaymentList(),
        getAdminLotList({ limit: 200, offset: 0 }),
        getAdminLotFulfilmentList().catch(() => []),
      ]);
      const allRows = buildAdminPaymentTableRows(payments, lots, fulfilmentRows);
      const filtered = filterPaymentTableRowsByStatus(allRows, q.status);
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

export const emailSuppressionsListController: IAdminListController<
  AdminEmailSuppressionListRow,
  AdminListQueryBase
> = {
  id: "email-suppressions",
  parseQuery(sp) {
    return parseListSearchParams(sp);
  },
  async fetch(q) {
    const all = await getAdminEmailSuppressions();
    const { rows, total } = sliceAdminListWindow(all, q.offset, q.limit);
    return { rows, offset: q.offset, limit: q.limit, total };
  },
};

export type AuditDomainEventsListQuery = AdminListQueryBase & {
  eventTypePrefix?: string | undefined;
};

export const auditDomainEventsListController: IAdminListController<
  AdminDomainEventRow,
  AuditDomainEventsListQuery
> = {
  id: "audit-domain-events",
  parseQuery(sp) {
    const base = parseListSearchParams(sp);
    const limit = parseBoundedInt(firstString(sp.limit), 100, 1, 500);
    const eventTypePrefix = firstString(sp.prefix)?.trim() || undefined;
    return { ...base, limit, eventTypePrefix };
  },
  async fetch(q) {
    const rows = await getAdminDomainEvents({
      limit: q.limit,
      offset: q.offset,
      ...(q.eventTypePrefix ? { eventTypePrefix: q.eventTypePrefix } : {}),
    });
    return { rows, offset: q.offset, limit: q.limit };
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

export type EmailOutboxListQuery = AdminListQueryBase & {
  status?: AdminEmailOutboxRow["status"] | "all" | undefined;
};

const outboxStatuses: AdminEmailOutboxRow["status"][] = [
  "pending",
  "sending",
  "sent",
  "failed",
  "suppressed",
];

export const emailOutboxListController: IAdminListController<
  AdminEmailOutboxRow,
  EmailOutboxListQuery
> = {
  id: "email-outbox",
  parseQuery(sp) {
    const base = parseListSearchParams(sp);
    const st = firstString(sp.status);
    const status =
      st && st !== "all" && (outboxStatuses as readonly string[]).includes(st)
        ? (st as AdminEmailOutboxRow["status"])
        : undefined;
    return { ...base, status };
  },
  async fetch(q) {
    const all = await getAdminEmailOutbox(
      q.status !== undefined ? { status: q.status } : undefined,
    );
    const { rows, total } = sliceAdminListWindow(all, q.offset, q.limit);
    return { rows, offset: q.offset, limit: q.limit, total };
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
    return { ...base, includeArchived };
  },
  async fetch(q) {
    const all = await getAdminCategoryList({ includeArchived: Boolean(q.includeArchived) });
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

export type AuditTimelineListQuery = AdminListQueryBase & {
  aggregateType?: string | undefined;
  aggregateId?: string | undefined;
};

export const auditTimelineListController: IAdminListController<
  AdminDomainEventRow,
  AuditTimelineListQuery
> = {
  id: "audit-timeline",
  parseQuery(sp) {
    const base = parseListSearchParams(sp);
    const limit = Math.min(500, Math.max(1, base.limit === 50 ? 200 : base.limit));
    const aggregateType = firstString(sp.aggregateType)?.trim() || undefined;
    const aggregateId = firstString(sp.aggregateId)?.trim() || undefined;
    return { ...base, limit, aggregateType, aggregateId };
  },
  async fetch(q) {
    if (!q.aggregateType || !q.aggregateId) {
      return { rows: [], offset: q.offset, limit: q.limit };
    }
    const rows = await getAdminDomainEvents({
      limit: q.limit,
      offset: q.offset,
      aggregateType: q.aggregateType,
      aggregateId: q.aggregateId,
    });
    return { rows, offset: q.offset, limit: q.limit };
  },
};

export const conditionReportsListController: IAdminListController<
  AdminConditionReportRequestRow,
  AdminListQueryBase
> = {
  id: "condition-reports",
  parseQuery(sp) {
    const base = parseListSearchParams(sp);
    return { ...base, limit: Math.min(80, base.limit) };
  },
  async fetch(q) {
    const { items, total, limit, offset } = await getAdminConditionReportRequests({
      status: "pending",
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
