"use server";

import { readApiActionErrorMeta } from "@/lib/actions/_utils";
import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { getWriteContainer } from "@/lib/data/write-container.server";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import { QR_CODES_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import type { AdminQrCodeItem } from "@/lib/services/interfaces/admin-qr-codes-service";
import {
  type QrCodeAnalyticsClientQuery,
  type QrCodeDetailedAnalytics,
  adminQrCodeCreateSchema,
  adminQrCodeEntityQuerySchema,
  adminQrCodeRegenerateSchema,
  normalizeApiErrorMessage,
} from "@auction/validators";
import { z } from "zod";

export type { AdminQrCodeItem };

export type AdminQrCodeDialogData = {
  item: AdminQrCodeItem;
  analytics: QrCodeDetailedAnalytics | null;
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

function qrServiceFailure(
  body: unknown,
  _message: string,
  status: number,
  code: string | undefined,
  fallback: string,
): ActionResult<never> {
  const err =
    body && typeof body === "object" && "error" in body
      ? (body as { error?: unknown }).error
      : undefined;
  const meta = readApiActionErrorMeta(body);
  return actionFailure(normalizeApiErrorMessage(err, fallback), undefined, status, code, meta);
}

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

    const analyticsResult = await getWriteContainer().adminQrCodes.getAnalytics(
      itemResult.data.id,
      {
        range: "30d",
      },
    );
    const analytics = analyticsResult.ok ? analyticsResult.data : null;
    return actionSuccess({ item: itemResult.data, analytics });
  });
}

export async function adminLoadQrCodeAnalyticsResultAction(
  qrCodeId: string,
  query: QrCodeAnalyticsClientQuery,
): Promise<ActionResult<QrCodeDetailedAnalytics>> {
  return instrumentServerAction("adminLoadQrCodeAnalyticsResultAction", async () => {
    const denied = await denyUnlessAdminCapability(QR_CODES_ACCESS);
    if (denied) return denied;

    const parsedId = z.string().uuid().safeParse(qrCodeId);
    if (!parsedId.success) return actionFailure("Invalid QR code id");

    const res = await getWriteContainer().adminQrCodes.getAnalytics(parsedId.data, query);
    if (!res.ok) {
      return qrServiceFailure(res.body, res.message, res.status, res.code, "qr_analytics_failed");
    }
    return actionSuccess(res.data);
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

    const res = await getWriteContainer().adminQrCodes.regenerate(parsed.data);
    if (!res.ok) {
      return qrServiceFailure(res.body, res.message, res.status, res.code, "qr_regenerate_failed");
    }
    return actionSuccess(res.data);
  });
}

async function getOrCreateQrCode(input: {
  entityType: "sale" | "lot";
  entityId: string;
}): Promise<ActionResult<AdminQrCodeItem>> {
  const listRes = await getWriteContainer().adminQrCodes.list(input);
  if (!listRes.ok) {
    return qrServiceFailure(
      listRes.body,
      listRes.message,
      listRes.status,
      listRes.code,
      "qr_list_failed",
    );
  }

  const existing = listRes.data[0] ?? null;
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

  const res = await getWriteContainer().adminQrCodes.create({
    entityType: parsed.data.entityType,
    entityId: parsed.data.entityId,
    placement: parsed.data.placement ?? input.placement,
  });
  if (!res.ok) {
    return qrServiceFailure(res.body, res.message, res.status, res.code, "qr_create_failed");
  }
  return actionSuccess(res.data);
}
