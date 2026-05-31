import type { ExportEntityType } from "@auction/exports";
import {
  type UserRole,
  canAccessPlatformAdminRoutes,
  normalizeUserRoleOrClient,
  normalizeUserStaffRole,
  roleHasCapability,
} from "@auction/types";
import type { ExportClientsFilters } from "@auction/validators";
import { AuthzError } from "../lib/errors.js";
import { mapExportClientsFilters } from "../lib/map-export-clients-filters.js";
import type { AdminDomainEventQueryService } from "../services/admin/admin-domain-event-query.service.js";
import type { IAdminUserReader } from "../services/interfaces/admin-user.js";
import type { IAnalyticsService } from "../services/interfaces/analytics.js";
import type { ILegalEntityRepository } from "../services/interfaces/legal-entity-repository.js";
import type {
  IPaymentWriteRepository,
  ListPaymentsExportFilter,
  PaymentRecord,
} from "../services/interfaces/payment-write.js";
import type { IPayoutRepository } from "../services/interfaces/payout-repository.js";
import type {
  IItemSubmissionRepository,
  ILotRepository,
  ISaleRepository,
  ListLotsFilter,
  ListSalesFilter,
  ListSubmissionsFilter,
} from "../services/interfaces/repositories.js";
import {
  requireCatalogueStaff,
  requireFinanceRead,
  requirePayoutRead,
  requirePlatformAdminAccess,
  resolveIncludePii,
} from "./auth.js";
import type { ExportAuthContext, ExportProvider } from "./types.js";
import { batchedRows } from "./types.js";

function summarizeFilters(filters: Record<string, unknown>): string {
  const parts = Object.entries(filters)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);
  return parts.length > 0 ? parts.join(" · ") : "All records";
}

function paymentExportFilter(filters: {
  status?: string;
  manualReview?: boolean;
}): ListPaymentsExportFilter {
  const out: ListPaymentsExportFilter = {};
  if (filters.manualReview === true) {
    out.manualReview = true;
  } else if (filters.status) {
    out.status = filters.status as PaymentRecord["status"];
  }
  return out;
}

async function assertClientPayoutAccess(
  ctx: ExportAuthContext,
  legalEntityId: string,
  legalEntityRepo: ILegalEntityRepository,
): Promise<void> {
  const membership = await legalEntityRepo.findActiveMembership(ctx.userId, legalEntityId);
  if (!membership) {
    throw new AuthzError("Payout export requires membership in the legal entity", 403);
  }
}

async function resolvePayoutScope(
  ctx: ExportAuthContext,
  filters: { legalEntityId?: string },
  legalEntityRepo: ILegalEntityRepository,
): Promise<{ legalEntityId?: string }> {
  const role = normalizeUserRoleOrClient(ctx.userRole) as UserRole;
  const staff = normalizeUserStaffRole(ctx.userStaffRole ?? undefined);
  const isStaffReader =
    roleHasCapability(role, "payout.read", staff) || canAccessPlatformAdminRoutes(role, staff);

  if (isStaffReader) {
    return filters.legalEntityId ? { legalEntityId: filters.legalEntityId } : {};
  }

  if (role !== "client") {
    throw new AuthzError("Payout export not allowed", 403);
  }

  const legalEntityId = filters.legalEntityId?.trim();
  if (!legalEntityId) {
    throw new AuthzError("Payout export requires legalEntityId", 403);
  }
  await assertClientPayoutAccess(ctx, legalEntityId, legalEntityRepo);
  return { legalEntityId };
}

function analyticsDateRange(days: number): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);
  return { start, end };
}

function formatPayoutDate(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export type ExportProviderDeps = {
  lotRepo: ILotRepository;
  saleRepo: ISaleRepository;
  submissionRepo: IItemSubmissionRepository;
  adminUserReader: IAdminUserReader;
  paymentRepo: Pick<IPaymentWriteRepository, "listForExport" | "countForExport">;
  domainEvents: AdminDomainEventQueryService;
  payoutRepo: IPayoutRepository;
  legalEntityRepo: ILegalEntityRepository;
  analytics: IAnalyticsService;
};

export function createExportProviders(
  deps: ExportProviderDeps,
): Map<ExportEntityType, ExportProvider> {
  const lotsProvider: ExportProvider<ListLotsFilter> = {
    entityType: "lots",
    authorize(ctx) {
      requireCatalogueStaff(ctx);
    },
    columns: () => [
      { key: "id", header: "id" },
      { key: "lotNumber", header: "lot_number" },
      { key: "title", header: "title" },
      { key: "status", header: "status" },
      { key: "saleId", header: "sale_id" },
      { key: "sellerLegalEntityId", header: "seller_legal_entity_id" },
      { key: "currentPrice", header: "current_price" },
      { key: "startTime", header: "start_time" },
      { key: "endTime", header: "end_time" },
      { key: "createdAt", header: "created_at" },
    ],
    async estimateCount(_ctx, filters) {
      return deps.lotRepo.countMatching(filters);
    },
    streamRows(_ctx, filters) {
      return batchedRows(
        (offset, limit) => deps.lotRepo.list({ ...filters, offset, limit }),
        (lot) => ({
          id: lot.id,
          lotNumber: lot.lotNumber ?? "",
          title: lot.title,
          status: lot.status,
          saleId: lot.saleId ?? "",
          sellerLegalEntityId: lot.sellerLegalEntityId ?? "",
          currentPrice: lot.currentPrice,
          startTime: lot.startTime?.toISOString() ?? "",
          endTime: lot.endTime?.toISOString() ?? "",
          createdAt: lot.createdAt.toISOString(),
        }),
      );
    },
    filterSummary: (_ctx, filters) => summarizeFilters(filters as Record<string, unknown>),
  };

  const salesProvider: ExportProvider<ListSalesFilter> = {
    entityType: "sales",
    authorize(ctx) {
      requireCatalogueStaff(ctx);
    },
    columns: () => [
      { key: "id", header: "id" },
      { key: "title", header: "title" },
      { key: "status", header: "status" },
      { key: "deliveryMode", header: "delivery_mode" },
      { key: "startTime", header: "start_time" },
      { key: "endTime", header: "end_time" },
      { key: "createdAt", header: "created_at" },
    ],
    async estimateCount(_ctx, filters) {
      return deps.saleRepo.countMatching(filters);
    },
    streamRows(_ctx, filters) {
      return batchedRows(
        (offset, limit) => deps.saleRepo.list({ ...filters, offset, limit }),
        (s) => ({
          id: s.id,
          title: s.title,
          status: s.status,
          deliveryMode: s.deliveryMode,
          startTime: s.startTime?.toISOString() ?? "",
          endTime: s.endTime?.toISOString() ?? "",
          createdAt: s.createdAt.toISOString(),
        }),
      );
    },
    filterSummary: (_ctx, filters) => summarizeFilters(filters as Record<string, unknown>),
  };

  const submissionsProvider: ExportProvider<ListSubmissionsFilter> = {
    entityType: "submissions",
    authorize(ctx) {
      requireCatalogueStaff(ctx);
    },
    columns: () => [
      { key: "id", header: "id" },
      { key: "title", header: "title" },
      { key: "status", header: "status" },
      { key: "legalEntityId", header: "legal_entity_id" },
      { key: "createdAt", header: "created_at" },
    ],
    async estimateCount(_ctx, filters) {
      return deps.submissionRepo.countAdmin(filters);
    },
    streamRows(_ctx, filters) {
      return batchedRows(
        (offset, limit) => deps.submissionRepo.listForAdmin({ ...filters, offset, limit }),
        (sub) => ({
          id: sub.id,
          title: sub.title,
          status: sub.status,
          legalEntityId: sub.legalEntityId,
          createdAt: sub.createdAt.toISOString(),
        }),
      );
    },
    filterSummary: (_ctx, filters) => summarizeFilters(filters as Record<string, unknown>),
  };

  const clientsProvider: ExportProvider<ExportClientsFilters> = {
    entityType: "clients",
    authorize(ctx) {
      requirePlatformAdminAccess(ctx);
    },
    columns: () => [
      { key: "id", header: "id" },
      { key: "email", header: "email" },
      { key: "name", header: "name" },
      { key: "role", header: "role" },
      { key: "staffRole", header: "staff_role" },
      { key: "mobile", header: "mobile" },
      { key: "mobileCountry", header: "mobile_country" },
      { key: "emailVerified", header: "email_verified" },
      { key: "emailStatus", header: "email_status" },
      { key: "kycStatus", header: "kyc_status" },
      { key: "kycVerifiedAt", header: "kyc_verified_at" },
      { key: "signupPersona", header: "signup_persona" },
      { key: "twoFactorEnabled", header: "two_factor" },
      { key: "suspendedAt", header: "suspended_at" },
      { key: "createdAt", header: "created_at" },
      { key: "updatedAt", header: "updated_at" },
    ],
    async estimateCount(_ctx, filters) {
      const result = await deps.adminUserReader.list(
        mapExportClientsFilters(filters, { limit: 1, offset: 0 }),
      );
      return result.total;
    },
    streamRows(_ctx, filters) {
      return batchedRows(
        async (offset, limit) => {
          const result = await deps.adminUserReader.list(
            mapExportClientsFilters(filters, { offset, limit }),
          );
          return result.rows;
        },
        (u) => ({
          id: u.id,
          email: u.email,
          name: u.name ?? "",
          role: u.role,
          staffRole: u.staffRole ?? "",
          mobile: u.mobile ?? "",
          mobileCountry: u.mobileCountry ?? "",
          emailVerified: u.emailVerified ? "true" : "false",
          emailStatus: u.emailStatus,
          kycStatus: u.kycStatus,
          kycVerifiedAt: u.kycVerifiedAt?.toISOString() ?? "",
          signupPersona: u.signupPersona ?? "",
          twoFactorEnabled: u.twoFactorEnabled ? "true" : "false",
          suspendedAt: u.suspendedAt?.toISOString() ?? "",
          createdAt: u.createdAt.toISOString(),
          updatedAt: u.updatedAt.toISOString(),
        }),
      );
    },
    filterSummary: (_ctx, filters) => summarizeFilters(filters as Record<string, unknown>),
  };

  const paymentsProvider: ExportProvider<{ status?: string; manualReview?: boolean }> = {
    entityType: "payments",
    authorize(ctx) {
      requireFinanceRead(ctx);
    },
    columns: () => [
      { key: "id", header: "id" },
      { key: "lotId", header: "lot_id" },
      { key: "buyerId", header: "buyer_id" },
      { key: "amount", header: "amount" },
      { key: "status", header: "status" },
      { key: "createdAt", header: "created_at" },
    ],
    async estimateCount(_ctx, filters) {
      return deps.paymentRepo.countForExport(paymentExportFilter(filters));
    },
    streamRows(_ctx, filters) {
      const exportFilter = paymentExportFilter(filters);
      return batchedRows(
        (offset, limit) => deps.paymentRepo.listForExport({ ...exportFilter, offset, limit }),
        (p) => ({
          id: p.id,
          lotId: p.lotId,
          buyerId: p.paidByUserId ?? "",
          amount: p.amount,
          status: p.status,
          createdAt: p.createdAt.toISOString(),
        }),
      );
    },
    filterSummary: (_ctx, filters) => summarizeFilters(filters as Record<string, unknown>),
  };

  const domainEventsProvider: ExportProvider<{
    aggregateType?: string;
    aggregateId?: string;
    includePii?: boolean;
  }> = {
    entityType: "domain-events",
    authorize(ctx, filters) {
      const aggType = filters.aggregateType?.trim();
      const aggId = filters.aggregateId?.trim();
      if (aggType && aggId) {
        requireCatalogueStaff(ctx);
      } else {
        requirePlatformAdminAccess(ctx);
      }
      resolveIncludePii(ctx, filters.includePii);
    },
    columns: () => [
      { key: "id", header: "id" },
      { key: "aggregateType", header: "aggregate_type" },
      { key: "aggregateId", header: "aggregate_id" },
      { key: "eventType", header: "event_type" },
      { key: "actorUserId", header: "actor_user_id" },
      { key: "actingLegalEntityId", header: "acting_legal_entity_id" },
      { key: "occurredAt", header: "occurred_at" },
      { key: "payloadJson", header: "payload_json" },
    ],
    async estimateCount(_ctx, filters) {
      return deps.domainEvents.countForExport({
        ...(filters.aggregateType ? { aggregateType: filters.aggregateType } : {}),
        ...(filters.aggregateId ? { aggregateId: filters.aggregateId } : {}),
      });
    },
    streamRows(ctx, filters) {
      const includePii = resolveIncludePii(ctx, filters.includePii);
      const scope = {
        includePii,
        ...(filters.aggregateType ? { aggregateType: filters.aggregateType } : {}),
        ...(filters.aggregateId ? { aggregateId: filters.aggregateId } : {}),
      };
      return batchedRows(
        (offset, limit) => deps.domainEvents.listRedacted({ ...scope, limit, offset }),
        (r) => ({
          id: String(r.id),
          aggregateType: r.aggregateType,
          aggregateId: r.aggregateId,
          eventType: r.eventType,
          actorUserId: r.actorUserId ?? "",
          actingLegalEntityId: r.actingLegalEntityId ?? "",
          occurredAt: r.occurredAt.toISOString(),
          payloadJson: JSON.stringify(r.payload),
        }),
      );
    },
    filterSummary: (_ctx, filters) => summarizeFilters(filters as Record<string, unknown>),
  };

  const payoutsProvider: ExportProvider<{ legalEntityId?: string }> = {
    entityType: "payouts",
    async authorize(ctx, filters) {
      requirePayoutRead(ctx);
      await resolvePayoutScope(ctx, filters, deps.legalEntityRepo);
    },
    columns: () => [
      { key: "id", header: "id" },
      { key: "periodStart", header: "period_start" },
      { key: "periodEnd", header: "period_end" },
      { key: "grossAmount", header: "gross_amount" },
      { key: "platformFee", header: "platform_fee" },
      { key: "stripeFee", header: "stripe_fee" },
      { key: "netAmount", header: "net_amount" },
      { key: "currency", header: "currency" },
      { key: "status", header: "status" },
    ],
    async estimateCount(ctx, filters) {
      const scope = await resolvePayoutScope(ctx, filters, deps.legalEntityRepo);
      return deps.payoutRepo.countMatching(scope);
    },
    async *streamRows(ctx, filters) {
      const scope = await resolvePayoutScope(ctx, filters, deps.legalEntityRepo);
      let offset = 0;
      const pageSize = 1000;
      while (true) {
        const page = await deps.payoutRepo.list({ ...scope, offset, limit: pageSize });
        if (page.length === 0) break;
        for (const p of page) {
          yield {
            id: p.id,
            periodStart: formatPayoutDate(p.periodStart),
            periodEnd: formatPayoutDate(p.periodEnd),
            grossAmount: p.grossAmount,
            platformFee: p.platformFee,
            stripeFee: p.stripeFee,
            netAmount: p.netAmount,
            currency: p.currency,
            status: p.status,
          };
        }
        if (page.length < pageSize) break;
        offset += pageSize;
      }
    },
    filterSummary: (_ctx, filters) => summarizeFilters(filters as Record<string, unknown>),
  };

  const analyticsProvider: ExportProvider<{
    days: number;
    series: "revenue" | "ended_lots" | "registrations";
  }> = {
    entityType: "analytics",
    authorize(ctx) {
      requirePlatformAdminAccess(ctx);
    },
    columns(_ctx, filters) {
      if (filters.series === "revenue") {
        return [
          { key: "date", header: "date" },
          { key: "revenue", header: "revenue" },
        ];
      }
      if (filters.series === "ended_lots") {
        return [
          { key: "date", header: "date" },
          { key: "endedLots", header: "ended_lots" },
        ];
      }
      return [
        { key: "date", header: "date" },
        { key: "registrations", header: "registrations" },
      ];
    },
    async estimateCount(_ctx, filters) {
      return filters.days;
    },
    async *streamRows(_ctx, filters) {
      const dashboard = await deps.analytics.getDashboard(analyticsDateRange(filters.days));
      if (filters.series === "revenue") {
        for (const row of dashboard.revenueSeries) {
          yield { date: row.date, revenue: row.total };
        }
        return;
      }
      if (filters.series === "ended_lots") {
        for (const row of dashboard.lotCompletedSeries) {
          yield { date: row.date, endedLots: String(row.count) };
        }
        return;
      }
      for (const row of dashboard.registrationSeries) {
        yield { date: row.date, registrations: String(row.count) };
      }
    },
    filterSummary: (_ctx, filters) => summarizeFilters(filters as Record<string, unknown>),
  };

  return new Map([
    ["lots", lotsProvider as ExportProvider],
    ["sales", salesProvider as ExportProvider],
    ["submissions", submissionsProvider as ExportProvider],
    ["clients", clientsProvider as ExportProvider],
    ["payments", paymentsProvider as ExportProvider],
    ["domain-events", domainEventsProvider as ExportProvider],
    ["payouts", payoutsProvider as ExportProvider],
    ["analytics", analyticsProvider as ExportProvider],
  ]);
}
