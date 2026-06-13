"use server";

import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import { QR_CODES_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import {
  type QrCodeAnalyticsRange,
  adminQrCodeCreateSchema,
  adminQrCodeEntityQuerySchema,
  adminQrCodeRegenerateSchema,
  normalizeApiErrorMessage,
} from "@auction/validators";
import { z } from "zod";

export type AdminQrCodeItem = {
  id: string;
  shortCode: string;
  shortUrl: string;
  destinationUrl: string;
  status: "active" | "disabled";
  campaign: string | null;
  placement: string | null;
};

export type AdminQrCodeBreakdownRow = { key: string; scans: number };

export type AdminQrCodeRecentScan = {
  scannedAt: string;
  deviceType: string;
  browser: string;
  os: string;
  country: string;
  referrerHost: string | null;
};

export type AdminQrCodeAnalytics = {
  source: "raw" | "daily";
  granularity: "hour" | "day";
  rangeKey: string;
  totalScans: number;
  uniqueIps: number | null;
  trend: { bucket: string; scans: number }[];
  byDevice: AdminQrCodeBreakdownRow[];
  byCountry: AdminQrCodeBreakdownRow[];
  byBrowser: AdminQrCodeBreakdownRow[] | null;
  byOs: AdminQrCodeBreakdownRow[] | null;
  byReferrer: AdminQrCodeBreakdownRow[] | null;
  recentScans: AdminQrCodeRecentScan[] | null;
};

export type AdminQrCodeAnalyticsQuery =
  | { range: QrCodeAnalyticsRange }
  | { from: string; to: string };

export type AdminQrCodeDialogData = {
  item: AdminQrCodeItem;
  analytics: AdminQrCodeAnalytics | null;
};

export type AdminLotQrPrintRow = {
  id: string;
  title: string;
  lotNumber: number | null;
  shortUrl: string;
};

const bulkPrintLotsSchema = z.array(
  z.object({
    id: z.string().uuid(),
    title: z.string().min(1),
    lotNumber: z.number().int().nullable(),
  }),
);

export async function adminLoadQrCodeDialogResultAction(
  entityType: "sale" | "lot",
  entityId: string,
): Promise<ActionResult<AdminQrCodeDialogData>> {
  return instrumentServerAction("adminLoadQrCodeDialogResultAction", async () => {
    const denied = await denyUnlessAdminCapability(QR_CODES_ACCESS);
    if (denied) return denied;

    const parsed = adminQrCodeEntityQuerySchema.safeParse({ entityType, entityId });
    if (!parsed.success) return actionFailure("Invalid QR code target");

    const itemResult = await getOrCreateQrCode(parsed.data);
    if (!itemResult.ok) return itemResult;
    if (!itemResult.data) return actionFailure("invalid_response");

    const analytics = await getQrCodeAnalytics(itemResult.data.id, { range: "30d" });
    return actionSuccess({ item: itemResult.data, analytics });
  });
}

export async function adminLoadQrCodeAnalyticsResultAction(
  qrCodeId: string,
  query: AdminQrCodeAnalyticsQuery,
): Promise<ActionResult<AdminQrCodeAnalytics>> {
  return instrumentServerAction("adminLoadQrCodeAnalyticsResultAction", async () => {
    const denied = await denyUnlessAdminCapability(QR_CODES_ACCESS);
    if (denied) return denied;

    const parsedId = z.string().uuid().safeParse(qrCodeId);
    if (!parsedId.success) return actionFailure("Invalid QR code id");

    const analytics = await getQrCodeAnalytics(parsedId.data, query);
    if (!analytics) return actionFailure("Could not load QR analytics");
    return actionSuccess(analytics);
  });
}

export async function adminEnsureLotQrCodesForPrintResultAction(
  lots: Array<{ id: string; title: string; lotNumber: number | null }>,
): Promise<ActionResult<AdminLotQrPrintRow[]>> {
  return instrumentServerAction("adminEnsureLotQrCodesForPrintResultAction", async () => {
    const denied = await denyUnlessAdminCapability(QR_CODES_ACCESS);
    if (denied) return denied;

    const parsed = bulkPrintLotsSchema.safeParse(lots);
    if (!parsed.success) return actionFailure("Invalid lot selection");

    const rows: AdminLotQrPrintRow[] = [];
    for (const lot of parsed.data) {
      const result = await ensureQrCode({
        entityType: "lot",
        entityId: lot.id,
        placement: "gallery-label",
      });
      if (!result.ok || !result.data) return actionFailure(`Could not prepare QR for ${lot.title}`);
      rows.push({ ...lot, shortUrl: result.data.shortUrl });
    }

    return actionSuccess(rows);
  });
}

export async function adminRegenerateQrCodeResultAction(
  entityType: "sale" | "lot",
  entityId: string,
): Promise<ActionResult<AdminQrCodeItem>> {
  return instrumentServerAction("adminRegenerateQrCodeResultAction", async () => {
    const denied = await denyUnlessAdminCapability(QR_CODES_ACCESS);
    if (denied) return denied;

    const parsed = adminQrCodeRegenerateSchema.safeParse({ entityType, entityId });
    if (!parsed.success) return actionFailure("Invalid QR code target");

    const res = await authedServerFetch("/admin/qr-codes/regenerate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
      skipActingLegalEntityHeader: true,
    });
    const body = (await res.json().catch(() => ({}))) as {
      data?: AdminQrCodeItem;
      error?: unknown;
    };
    if (!res.ok) return actionFailure(normalizeApiErrorMessage(body.error, "qr_regenerate_failed"));
    if (!body.data) return actionFailure("invalid_response");
    return actionSuccess(body.data);
  });
}

async function getOrCreateQrCode(input: {
  entityType: "sale" | "lot";
  entityId: string;
}): Promise<ActionResult<AdminQrCodeItem>> {
  const qs = new URLSearchParams(input);
  const listRes = await authedServerFetch(`/admin/qr-codes?${qs}`, {
    skipActingLegalEntityHeader: true,
  });
  const listBody = (await listRes.json().catch(() => ({}))) as {
    data?: { items?: AdminQrCodeItem[] };
    error?: unknown;
  };
  if (!listRes.ok) {
    return actionFailure(normalizeApiErrorMessage(listBody.error, "qr_list_failed"));
  }

  const existing = listBody.data?.items?.[0] ?? null;
  if (existing) return actionSuccess(existing);
  return ensureQrCode({ ...input, placement: "admin" });
}

async function ensureQrCode(input: {
  entityType: "sale" | "lot";
  entityId: string;
  placement: string;
}): Promise<ActionResult<AdminQrCodeItem>> {
  const parsed = adminQrCodeCreateSchema.safeParse(input);
  if (!parsed.success) return actionFailure("Invalid QR code request");

  const res = await authedServerFetch("/admin/qr-codes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
    skipActingLegalEntityHeader: true,
  });
  const body = (await res.json().catch(() => ({}))) as {
    data?: AdminQrCodeItem;
    error?: unknown;
  };
  if (!res.ok) return actionFailure(normalizeApiErrorMessage(body.error, "qr_create_failed"));
  if (!body.data) return actionFailure("invalid_response");
  return actionSuccess(body.data);
}

async function getQrCodeAnalytics(
  qrCodeId: string,
  query: AdminQrCodeAnalyticsQuery,
): Promise<AdminQrCodeAnalytics | null> {
  const qs = new URLSearchParams();
  if ("range" in query) {
    qs.set("range", query.range);
  } else {
    qs.set("from", query.from);
    qs.set("to", query.to);
  }
  const res = await authedServerFetch(`/admin/qr-codes/${qrCodeId}/analytics?${qs}`, {
    skipActingLegalEntityHeader: true,
  });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => ({}))) as {
    data?: AdminQrCodeAnalytics;
  };
  return body.data ?? null;
}
