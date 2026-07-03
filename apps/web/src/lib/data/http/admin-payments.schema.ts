import { parseAdminPaymentRow, parseAdminPayoutRow } from "@/lib/data/http/admin-parse.server";
import type {
  AdminPaymentRow,
  AdminPaymentsListPageResult,
  AdminPayoutRow,
  AdminXeroIntegrationStatus,
} from "@/lib/data/http/admin-payments.types";
import { isIndexableObject, toObjectRecord } from "@/lib/data/http/object-guards";
import type { AdminPaymentTableRow } from "@/lib/data/view-models/admin-payments-table.vm";
import { z } from "zod";

export const adminPaymentTableRowSchema = z
  .preprocess((raw) => raw, z.unknown())
  .transform((raw): AdminPaymentTableRow => {
    const row = isIndexableObject(raw) ? raw : {};
    const base = parseAdminPaymentRow(raw);
    return {
      id: base.id,
      lotId: base.lotId,
      lotTitle: String(row.lotTitle ?? base.lotId),
      buyerId: base.buyerId,
      buyerLabel: row.buyerLabel == null ? null : String(row.buyerLabel),
      sellerId: base.sellerId,
      amount: base.amount,
      platformFee: base.platformFee,
      status: base.status,
      fulfilmentStatus: row.fulfilmentStatus == null ? null : String(row.fulfilmentStatus),
      xeroInvoiceNumber: base.xeroInvoiceNumber,
      xeroOnlineInvoiceUrl: base.xeroOnlineInvoiceUrl,
      xeroSyncStatus: base.xeroSyncStatus,
      xeroLastError: base.xeroLastError,
    };
  });

export const adminPaymentRowsSchema = z.array(
  z.preprocess((raw) => raw, z.unknown()).transform((raw) => parseAdminPaymentRow(raw)),
) as z.ZodType<AdminPaymentRow[]>;

export const adminPayoutRowsSchema = z.array(
  z.preprocess((raw) => raw, z.unknown()).transform((raw) => parseAdminPayoutRow(raw)),
) as z.ZodType<AdminPayoutRow[]>;

function parseMoneyStat(value: unknown): number {
  const n = Number.parseFloat(String(value ?? "0"));
  return Number.isFinite(n) ? n : 0;
}

const xeroConnectionHealthValues = ["healthy", "degraded", "disconnected"] as const;
const xeroConnectionStatusValues = ["healthy", "needs_reauth"] as const;

export const adminXeroIntegrationStatusSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row): AdminXeroIntegrationStatus => {
    const connectedByRaw = isIndexableObject(row.connectedBy) ? row.connectedBy : null;
    const healthRaw = row.health;
    const health =
      typeof healthRaw === "string" &&
      (xeroConnectionHealthValues as readonly string[]).includes(healthRaw)
        ? (healthRaw as AdminXeroIntegrationStatus["health"])
        : "disconnected";
    const connectionStatusRaw = row.connectionStatus;
    const connectionStatus =
      typeof connectionStatusRaw === "string" &&
      (xeroConnectionStatusValues as readonly string[]).includes(connectionStatusRaw)
        ? (connectionStatusRaw as NonNullable<AdminXeroIntegrationStatus["connectionStatus"]>)
        : null;
    return {
      connected: Boolean(row.connected),
      tenantId: row.tenantId == null ? null : String(row.tenantId),
      tenantName: row.tenantName == null ? null : String(row.tenantName),
      expiresAt: row.expiresAt == null ? null : String(row.expiresAt),
      oauthConfigured: Boolean(row.oauthConfigured),
      connectedAt: row.connectedAt == null ? null : String(row.connectedAt),
      updatedAt: row.updatedAt == null ? null : String(row.updatedAt),
      connectedBy:
        connectedByRaw == null
          ? null
          : {
              id: String(connectedByRaw.id ?? ""),
              name: String(connectedByRaw.name ?? ""),
              email: String(connectedByRaw.email ?? ""),
            },
      scopes: row.scopes == null ? null : String(row.scopes),
      webhookConfigured: Boolean(row.webhookConfigured),
      webhookUrl: row.webhookUrl == null ? null : String(row.webhookUrl),
      recentWebhookErrors: Number(row.recentWebhookErrors ?? 0),
      syncErrorCount: Number(row.syncErrorCount ?? 0),
      health,
      connectionStatus,
      lastRefreshError: row.lastRefreshError == null ? null : String(row.lastRefreshError),
      orgShortCode: row.orgShortCode == null ? null : String(row.orgShortCode),
      orgBaseCurrency: row.orgBaseCurrency == null ? null : String(row.orgBaseCurrency),
    };
  }) as z.ZodType<AdminXeroIntegrationStatus>;

export function parseAdminPaymentsListPageBody(
  body: unknown,
  params: { limit: number; offset: number },
): AdminPaymentsListPageResult {
  const envelope = isIndexableObject(body) ? body : {};
  const rows = Array.isArray(envelope.data)
    ? envelope.data.map((row) => adminPaymentTableRowSchema.parse(row))
    : [];
  const meta = isIndexableObject(envelope.meta) ? envelope.meta : {};
  const summaryRaw = isIndexableObject(meta.summary) ? meta.summary : {};
  return {
    rows,
    total: Number(meta.total ?? rows.length),
    offset: Number(meta.offset ?? params.offset),
    limit: Number(meta.limit ?? params.limit),
    summary: {
      totalVolume: parseMoneyStat(summaryRaw.totalVolume),
      captured: parseMoneyStat(summaryRaw.captured),
      pending: parseMoneyStat(summaryRaw.pending),
      refunded: parseMoneyStat(summaryRaw.refunded),
    },
  };
}

export function parseAdminPaymentTableRow(raw: unknown): AdminPaymentTableRow {
  return adminPaymentTableRowSchema.parse(raw);
}

export const adminXeroOAuthConsentUrlSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row) => ({ url: String(row.url ?? "") })) as z.ZodType<{ url: string }>;

type _AdminXeroIntegrationStatusInfer = z.infer<typeof adminXeroIntegrationStatusSchema>;
const _adminXeroIntegrationStatusGuard =
  null as unknown as _AdminXeroIntegrationStatusInfer satisfies AdminXeroIntegrationStatus;
void _adminXeroIntegrationStatusGuard;
