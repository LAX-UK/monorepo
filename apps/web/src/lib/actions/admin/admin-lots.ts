"use server";

import { readApiActionErrorMeta } from "@/lib/actions/_utils";
import { revalidateAdminLotDetail } from "@/lib/actions/admin/_shared/revalidate-paths";
import {
  getIdempotentLotCreate,
  getIdempotentLotPublish,
  setIdempotentLotCreate,
  setIdempotentLotPublish,
} from "@/lib/actions/idempotency-cache";
import { revalidateAdminSaleDetail } from "@/lib/actions/revalidate-admin-sale-detail";
import {
  type BulkLotsActionResult,
  bulkLotsFailureMessage,
  parseBulkLotsApiResponse,
} from "@/lib/admin/bulk-ops/lot-bulk-result";
import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { getAdminLotById } from "@/lib/data/http/admin.server";
import { getWriteContainer } from "@/lib/data/write-container.server";
import {
  type ActionResult,
  actionFailure,
  actionSuccess,
  firstZodErrorMessage,
  zodErrorToFieldErrors,
} from "@/lib/forms/form-result";
import { LOTS_ACCESS, SALES_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import type { Lot } from "@auction/types";
import {
  bulkLotsBodySchema,
  cancelLotBodySchema,
  createLotSchema,
  returnLotToInventoryBodySchema,
  updateLotMarketingDetailsSchema,
  updateLotSchema,
} from "@auction/validators";
import { revalidatePath } from "next/cache";
import type { z } from "zod";

export async function adminCreateLotResultAction(
  input: z.infer<typeof createLotSchema>,
  idempotencyKey?: string,
): Promise<ActionResult<{ id: string }>> {
  return instrumentServerAction("adminCreateLotResultAction", async () => {
    const denied = await denyUnlessAdminCapability(LOTS_ACCESS);
    if (denied) return denied;
    const cachedId = getIdempotentLotCreate(idempotencyKey);
    if (cachedId) return actionSuccess({ id: cachedId });
    const parsed = createLotSchema.safeParse(input);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
    }
    if (parsed.data == null) {
      return actionFailure("Invalid lot payload");
    }
    const { adminLots } = getWriteContainer();
    const r = await adminLots.create(parsed.data);
    if (!r.ok) {
      const meta = readApiActionErrorMeta(r.body);
      return actionFailure(r.message, undefined, r.status, r.code, meta);
    }
    setIdempotentLotCreate(idempotencyKey, r.data.id);
    revalidatePath("/admin/lots");
    return actionSuccess({ id: r.data.id });
  });
}

export async function adminUpdateLotMarketingDetailsResultAction(
  lotId: string,
  input: z.infer<typeof updateLotMarketingDetailsSchema>,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminUpdateLotMarketingDetailsResultAction", async () => {
    const denied = await denyUnlessAdminCapability(LOTS_ACCESS);
    if (denied) return denied;
    const id = lotId.trim();
    if (!id) {
      return actionFailure("Missing lot");
    }
    const parsed = updateLotMarketingDetailsSchema.safeParse(input);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
    }
    const { adminLots } = getWriteContainer();
    const r = await adminLots.updateMarketingDetails(id, parsed.data);
    if (!r.ok) {
      return actionFailure(r.message, undefined, r.status);
    }
    revalidatePath("/admin/lots");
    revalidatePath(`/admin/lots/${id}`);
    revalidatePath("/", "layout");
    return actionSuccess();
  });
}

export async function adminGetLotAttachPreviewAction(lotId: string): Promise<ActionResult<Lot>> {
  return instrumentServerAction("adminGetLotAttachPreviewAction", async () => {
    const denied = await denyUnlessAdminCapability(LOTS_ACCESS);
    if (denied) return denied;
    const id = lotId.trim();
    if (!id) {
      return actionFailure("Missing lot");
    }
    const lot = await getAdminLotById(id).catch(() => null);
    if (!lot) {
      return actionFailure("Lot not found", undefined, 404);
    }
    if (lot.status !== "draft") {
      return actionFailure("Only draft lots can be attached");
    }
    if (lot.saleId != null) {
      return actionFailure("Lot already belongs to a sale");
    }
    return actionSuccess(lot);
  });
}

export async function adminUpdateLotResultAction(
  lotId: string,
  input: z.infer<typeof updateLotSchema>,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminUpdateLotResultAction", async () => {
    const denied = await denyUnlessAdminCapability(LOTS_ACCESS);
    if (denied) return denied;
    const id = lotId.trim();
    if (!id) {
      return actionFailure("Missing lot");
    }
    const parsed = updateLotSchema.safeParse(input);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
    }
    if (parsed.data == null) {
      return actionFailure("Invalid update payload");
    }
    const existing = await getAdminLotById(id).catch(() => null);
    const previousSaleId = existing?.saleId ?? null;
    const { adminLots } = getWriteContainer();
    const r = await adminLots.update(id, parsed.data);
    if (!r.ok) {
      const meta = readApiActionErrorMeta(r.body);
      return actionFailure(r.message, undefined, r.status, r.code, meta);
    }
    const newSaleId =
      parsed.data.saleId !== undefined ? (parsed.data.saleId ?? null) : previousSaleId;
    revalidateAdminLotDetail(id);
    revalidatePath("/admin/sales");
    if (previousSaleId) {
      revalidatePath(`/admin/sales/${previousSaleId}`);
    }
    if (newSaleId && newSaleId !== previousSaleId) {
      revalidatePath(`/admin/sales/${newSaleId}`);
    }
    return actionSuccess();
  });
}

export async function adminPublishLotResultAction(
  lotId: string,
  idempotencyKey?: string,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminPublishLotResultAction", async () => {
    const denied = await denyUnlessAdminCapability(LOTS_ACCESS);
    if (denied) return denied;
    const id = lotId.trim();
    if (!id) {
      return actionFailure("Missing lot");
    }
    if (getIdempotentLotPublish(id, idempotencyKey)) {
      return actionSuccess();
    }
    const { adminLots } = getWriteContainer();
    const r = await adminLots.publish(id);
    if (!r.ok) {
      return actionFailure(r.message, undefined, r.status, r.code);
    }
    setIdempotentLotPublish(id, idempotencyKey);
    revalidatePath("/admin/lots");
    revalidatePath(`/admin/lots/${id}`);
    return actionSuccess();
  });
}

export async function adminCancelLotResultAction(
  lotId: string,
  body: z.infer<typeof cancelLotBodySchema>,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminCancelLotResultAction", async () => {
    const denied = await denyUnlessAdminCapability(SALES_ACCESS);
    if (denied) return denied;
    const id = lotId.trim();
    if (!id) {
      return actionFailure("Missing lot");
    }
    const p = cancelLotBodySchema.safeParse(body);
    if (!p.success) {
      return actionFailure(firstZodErrorMessage(p.error), zodErrorToFieldErrors(p.error));
    }
    const { adminLots } = getWriteContainer();
    const r = await adminLots.cancel(id, p.data);
    if (!r.ok) {
      return actionFailure(r.message, undefined, r.status);
    }
    revalidatePath("/admin/lots");
    revalidatePath(`/admin/lots/${id}`);
    return actionSuccess();
  });
}

export async function adminSoftDeleteLotResultAction(
  lotId: string,
  confirmationPhrase: string,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminSoftDeleteLotResultAction", async () => {
    const denied = await denyUnlessAdminCapability(SALES_ACCESS);
    if (denied) return denied;
    const id = lotId.trim();
    const phrase = confirmationPhrase.trim();
    if (!id) {
      return actionFailure("Missing lot");
    }
    if (!phrase) {
      return actionFailure("Confirmation phrase is required");
    }
    const { adminLots } = getWriteContainer();
    const r = await adminLots.softDelete(id, phrase);
    if (!r.ok) {
      return actionFailure(r.message, undefined, r.status);
    }
    revalidatePath("/admin/lots");
    revalidatePath("/");
    return actionSuccess();
  });
}

export async function adminReturnLotToInventoryResultAction(
  lotId: string,
  body: z.infer<typeof returnLotToInventoryBodySchema>,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminReturnLotToInventoryResultAction", async () => {
    const denied = await denyUnlessAdminCapability(SALES_ACCESS);
    if (denied) return denied;
    const id = lotId.trim();
    if (!id) {
      return actionFailure("Missing lot");
    }
    const p = returnLotToInventoryBodySchema.safeParse(body);
    if (!p.success) {
      return actionFailure(firstZodErrorMessage(p.error), zodErrorToFieldErrors(p.error));
    }
    const lotBefore = await getAdminLotById(id);
    const { adminLots } = getWriteContainer();
    const r = await adminLots.returnToInventory(id, p.data);
    if (!r.ok) {
      const meta = readApiActionErrorMeta(r.body);
      return actionFailure(r.message, undefined, r.status, meta?.code as string | undefined);
    }
    revalidatePath("/admin/lots");
    revalidatePath(`/admin/lots/${id}`);
    if (lotBefore?.saleId) {
      revalidateAdminSaleDetail(lotBefore.saleId);
    }
    return actionSuccess();
  });
}

export async function adminApproveWithdrawalRequestResultAction(
  lotId: string,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminApproveWithdrawalRequestResultAction", async () => {
    const denied = await denyUnlessAdminCapability(LOTS_ACCESS);
    if (denied) return denied;
    const id = lotId.trim();
    if (!id) return actionFailure("Missing lot ID");
    const { adminLots } = getWriteContainer();
    const r = await adminLots.approveWithdrawalRequest(id);
    if (!r.ok) {
      return actionFailure(r.message || "Failed to approve withdrawal");
    }
    revalidatePath("/admin/lots");
    revalidatePath(`/admin/lots/${id}`);
    return actionSuccess();
  });
}

export async function adminBulkLotsResultAction(
  body: z.infer<typeof bulkLotsBodySchema>,
): Promise<ActionResult<BulkLotsActionResult>> {
  return instrumentServerAction("adminBulkLotsResultAction", async () => {
    const parsed = bulkLotsBodySchema.safeParse(body);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
    }
    const access =
      parsed.data.op === "soft_delete"
        ? SALES_ACCESS
        : parsed.data.op === "cancel"
          ? SALES_ACCESS
          : LOTS_ACCESS;
    const denied = await denyUnlessAdminCapability(access);
    if (denied) return denied;
    const { adminLots } = getWriteContainer();
    const r = await adminLots.bulk(parsed.data);
    if (!r.ok) {
      return actionFailure(r.message, undefined, r.status, r.code);
    }
    const bulk = parseBulkLotsApiResponse(r.data);
    if (!bulk) {
      return actionFailure("Unexpected bulk response from server");
    }
    revalidatePath("/admin/lots");
    revalidatePath("/admin/sales");
    for (const lotId of parsed.data.ids) {
      revalidateAdminLotDetail(lotId);
    }
    if (bulk.failed >= bulk.attempted) {
      return actionFailure(bulkLotsFailureMessage(bulk), undefined, undefined, undefined, { bulk });
    }
    return actionSuccess(bulk);
  });
}
