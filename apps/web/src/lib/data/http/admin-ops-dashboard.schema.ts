import type {
  AdminAnalyticsPayload,
  AdminAttentionFeedItem,
  AdminFinanceIssuesPayload,
  AdminManualReviewPaymentRow,
  AdminOnboardingIssuesPayload,
  AdminTodayMetricsPayload,
} from "@/lib/data/http/admin-ops-dashboard.types";
import { isIndexableObject, toObjectRecord } from "@/lib/data/http/object-guards";
import { zNullableStringFromEmpty } from "@/lib/data/http/schema-coerce";
import { legalEntityStatuses } from "@auction/types";
import type { LegalEntityStatus } from "@auction/types";
import { z } from "zod";

const dateCountSeriesSchema = z.array(
  z
    .preprocess(toObjectRecord, z.record(z.unknown()))
    .transform((row) => ({ date: String(row.date ?? ""), count: Number(row.count ?? 0) })),
);

const dateTotalSeriesSchema = z.array(
  z
    .preprocess(toObjectRecord, z.record(z.unknown()))
    .transform((row) => ({ date: String(row.date ?? ""), total: String(row.total ?? "0") })),
);

const numberArraySchema = z.preprocess(
  (value) => (Array.isArray(value) ? value.map(Number) : []),
  z.array(z.number()),
);

export const adminAnalyticsPayloadSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row): AdminAnalyticsPayload => {
    const conversionRaw = isIndexableObject(row.conversion) ? row.conversion : {};
    const sparklinesRaw = isIndexableObject(row.sparklines) ? row.sparklines : undefined;
    return {
      activeLots: Number(row.activeLots ?? 0),
      lotCompletedSeries: dateCountSeriesSchema.parse(row.lotCompletedSeries),
      conversion: {
        ended: Number(conversionRaw.ended ?? 0),
        withWinner: Number(conversionRaw.withWinner ?? 0),
      },
      revenueSeries: dateTotalSeriesSchema.parse(row.revenueSeries),
      averageOrderValue: zNullableStringFromEmpty.parse(row.averageOrderValue),
      registrationSeries: dateCountSeriesSchema.parse(row.registrationSeries),
      totalUsers: Number(row.totalUsers ?? 0),
      ...(sparklinesRaw
        ? {
            sparklines: {
              revenue: numberArraySchema.parse(sparklinesRaw.revenue),
              lotCompleted: numberArraySchema.parse(sparklinesRaw.lotCompleted),
              registrations: numberArraySchema.parse(sparklinesRaw.registrations),
            },
          }
        : {}),
    };
  }) as z.ZodType<AdminAnalyticsPayload>;

export const adminTodayMetricsPayloadSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform(
    (row): AdminTodayMetricsPayload => ({
      liveLots: Number(row.liveLots ?? 0),
      endingWithinHour: Number(row.endingWithinHour ?? 0),
      draftLots: Number(row.draftLots ?? 0),
      pendingSubmissions: Number(row.pendingSubmissions ?? 0),
      stalePendingPayments: Number(row.stalePendingPayments ?? 0),
      revenueToday: String(row.revenueToday ?? "0"),
    }),
  ) as z.ZodType<AdminTodayMetricsPayload>;

export const adminFinanceIssuesPayloadSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform(
    (row): AdminFinanceIssuesPayload => ({
      failedPayoutCount: Number(row.failedPayoutCount ?? 0),
      legalEntitiesWithStripeConnectRequirementsCount: Number(
        row.legalEntitiesWithStripeConnectRequirementsCount ?? 0,
      ),
      staleBlockedScheduledPayoutCount: Number(row.staleBlockedScheduledPayoutCount ?? 0),
      entitiesPendingReviewCount: Number(row.entitiesPendingReviewCount ?? 0),
      artistsPendingApprovalCount: Number(row.artistsPendingApprovalCount ?? 0),
      staleKycSessionsCount: Number(row.staleKycSessionsCount ?? 0),
      documentsAwaitingReviewCount: Number(row.documentsAwaitingReviewCount ?? 0),
      staleLeadOrganisationsCount: Number(row.staleLeadOrganisationsCount ?? 0),
    }),
  ) as z.ZodType<AdminFinanceIssuesPayload>;

const entitySummaryRowSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row) => ({
    id: String(row.id ?? ""),
    displayName: String(row.displayName ?? ""),
    status: String(row.status ?? ""),
  }));

const staleKycSessionRowSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row) => ({
    id: String(row.id ?? ""),
    userId: String(row.userId ?? ""),
    userName: row.userName == null ? null : String(row.userName),
    userEmail: row.userEmail == null ? null : String(row.userEmail),
    provider: String(row.provider ?? ""),
    status: String(row.status ?? ""),
    createdAt: String(row.createdAt ?? ""),
  }));

const documentAwaitingReviewRowSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row) => ({
    id: String(row.id ?? ""),
    legalEntityId: String(row.legalEntityId ?? ""),
    entityDisplayName: String(row.entityDisplayName ?? ""),
    uploadObjectId: String(row.uploadObjectId ?? ""),
    uploadedAt: String(row.uploadedAt ?? ""),
  }));

const staleLeadOrganisationRowSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row) => ({
    id: String(row.id ?? ""),
    displayName: String(row.displayName ?? ""),
    createdAt: String(row.createdAt ?? ""),
  }));

export const adminOnboardingIssuesPayloadSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform(
    (row): AdminOnboardingIssuesPayload => ({
      entitiesPendingReview: z.array(entitySummaryRowSchema).parse(row.entitiesPendingReview),
      artistsPendingApproval: z.array(entitySummaryRowSchema).parse(row.artistsPendingApproval),
      staleKycSessions: z.array(staleKycSessionRowSchema).parse(row.staleKycSessions),
      documentsAwaitingReview: z
        .array(documentAwaitingReviewRowSchema)
        .parse(row.documentsAwaitingReview),
      staleLeadOrganisations: z
        .array(staleLeadOrganisationRowSchema)
        .parse(row.staleLeadOrganisations),
    }),
  ) as z.ZodType<AdminOnboardingIssuesPayload>;

const manualReviewReasons = [
  "seller_archived",
  "high_value",
  "seller_archived_and_high_value",
  "aml_hold",
  "source_of_funds_required",
  "finance_release_required",
] as const;

export const adminManualReviewPaymentRowSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row): AdminManualReviewPaymentRow => {
    const sellerStatusRaw = row.sellerStatus;
    const sellerStatus =
      typeof sellerStatusRaw === "string" &&
      legalEntityStatuses.includes(sellerStatusRaw as LegalEntityStatus)
        ? (sellerStatusRaw as LegalEntityStatus)
        : "lead";
    const reasonRaw = row.manualReviewReason;
    const manualReviewReason =
      typeof reasonRaw === "string" &&
      (manualReviewReasons as readonly string[]).includes(reasonRaw)
        ? (reasonRaw as AdminManualReviewPaymentRow["manualReviewReason"])
        : null;
    return {
      paymentId: String(row.paymentId ?? ""),
      lotId: String(row.lotId ?? ""),
      lotTitle: String(row.lotTitle ?? ""),
      lotNumber:
        row.lotNumber == null || row.lotNumber === ""
          ? null
          : Number.parseInt(String(row.lotNumber), 10),
      winnerUserId: String(row.winnerUserId ?? ""),
      winnerEmail: String(row.winnerEmail ?? ""),
      sellerLegalEntityId: String(row.sellerLegalEntityId ?? ""),
      sellerDisplayName: String(row.sellerDisplayName ?? ""),
      sellerStatus,
      sellerArchivedAt: zNullableStringFromEmpty.parse(row.sellerArchivedAt),
      amount: String(row.amount ?? "0"),
      currency: String(row.currency ?? "GBP"),
      archiveReason: zNullableStringFromEmpty.parse(row.archiveReason),
      archiveTimestamp: zNullableStringFromEmpty.parse(row.archiveTimestamp),
      manualReviewReason,
      sourceOfFundsCaseId: zNullableStringFromEmpty.parse(row.sourceOfFundsCaseId),
      createdAt: String(row.createdAt ?? ""),
    };
  });

export const adminManualReviewPaymentsSchema = z.array(
  adminManualReviewPaymentRowSchema,
) as z.ZodType<AdminManualReviewPaymentRow[]>;

const attentionFeedKinds = [
  "submission_under_review",
  "payment_stale",
  "lot_draft_past_start",
] as const;

export const adminAttentionFeedItemSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row): AdminAttentionFeedItem => {
    const kindRaw = row.kind;
    const kind =
      typeof kindRaw === "string" && (attentionFeedKinds as readonly string[]).includes(kindRaw)
        ? (kindRaw as AdminAttentionFeedItem["kind"])
        : "submission_under_review";
    return {
      id: String(row.id ?? ""),
      kind,
      title: String(row.title ?? ""),
      hint: String(row.hint ?? ""),
      href: String(row.href ?? ""),
      ...(row.ctaLabel == null || row.ctaLabel === "" ? {} : { ctaLabel: String(row.ctaLabel) }),
      createdAt: String(row.createdAt ?? ""),
    };
  });

export const adminAttentionFeedSchema = z.array(adminAttentionFeedItemSchema) as z.ZodType<
  AdminAttentionFeedItem[]
>;

export const adminLiveMetricsSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row) => ({ bidsPerMinute: Number(row.bidsPerMinute ?? 0) })) as z.ZodType<{
  bidsPerMinute: number;
}>;

type _AdminAnalyticsPayloadInfer = z.infer<typeof adminAnalyticsPayloadSchema>;
const _adminAnalyticsPayloadGuard =
  null as unknown as _AdminAnalyticsPayloadInfer satisfies AdminAnalyticsPayload;
void _adminAnalyticsPayloadGuard;
