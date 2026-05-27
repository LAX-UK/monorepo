"use server";

import { instrumentServerAction } from "@/lib/observability/instrument-server-action";

import { readApiActionErrorMeta } from "@/lib/actions/_utils";
import { getIdempotentSaleCreate, setIdempotentSaleCreate } from "@/lib/actions/idempotency-cache";
import { revalidateAdminSaleDetail } from "@/lib/actions/revalidate-admin-sale-detail";
import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { getWriteContainer } from "@/lib/data/write-container.server";
import {
  type ActionResult,
  actionFailure,
  actionSuccess,
  firstZodErrorMessage,
  zodErrorToFieldErrors,
} from "@/lib/forms/form-result";
import { LOTS_ACCESS, SALES_ACCESS } from "@/lib/navigation/staff-nav-access";
import type { LotStatus } from "@auction/types";
import {
  createNestedLotForSaleSchema,
  createSaleSchema,
  updateSaleSchema,
} from "@auction/validators";
import { revalidatePath } from "next/cache";
import type { z } from "zod";

export async function adminCreateSaleResultAction(
  input: z.infer<typeof createSaleSchema>,
  idempotencyKey?: string,
): Promise<ActionResult<{ id: string }>> {
  return instrumentServerAction("adminCreateSaleResultAction", async () => {
    const denied = await denyUnlessAdminCapability(SALES_ACCESS);
    if (denied) return denied;
    const cachedId = getIdempotentSaleCreate(idempotencyKey);
    if (cachedId) return actionSuccess({ id: cachedId });
    const parsed = createSaleSchema.safeParse(input);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
    }
    const { adminSales } = getWriteContainer();
    const r = await adminSales.create(parsed.data);
    if (!r.ok) {
      return actionFailure(r.message, undefined, r.status);
    }
    setIdempotentSaleCreate(idempotencyKey, r.data.id);
    revalidatePath("/admin/sales");
    revalidatePath("/");
    return actionSuccess({ id: r.data.id });
  });
}

export async function adminUpdateSaleResultAction(
  saleId: string,
  input: z.infer<typeof updateSaleSchema>,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminUpdateSaleResultAction", async () => {
    const denied = await denyUnlessAdminCapability(SALES_ACCESS);
    if (denied) return denied;
    const id = saleId.trim();
    if (!id) {
      return actionFailure("Missing sale");
    }
    const parsed = updateSaleSchema.safeParse(input);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
    }
    const { adminSales } = getWriteContainer();
    const r = await adminSales.update(id, parsed.data);
    if (!r.ok) {
      const meta = readApiActionErrorMeta(r.body);
      return actionFailure(r.message, undefined, r.status, r.code, meta);
    }
    revalidateAdminSaleDetail(id);
    revalidatePath("/");
    return actionSuccess();
  });
}

export async function adminAddLotToSaleResultAction(
  saleId: string,
  input: z.infer<typeof createNestedLotForSaleSchema>,
): Promise<ActionResult<{ id: string }>> {
  return instrumentServerAction("adminAddLotToSaleResultAction", async () => {
    const denied = await denyUnlessAdminCapability(LOTS_ACCESS);
    if (denied) return denied;
    const sid = saleId.trim();
    if (!sid) {
      return actionFailure("Missing sale");
    }
    const parsed = createNestedLotForSaleSchema.safeParse(input);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
    }
    const { adminSales } = getWriteContainer();
    const r = await adminSales.createNestedLot(sid, parsed.data);
    if (!r.ok) {
      const meta = readApiActionErrorMeta(r.body);
      return actionFailure(r.message, undefined, r.status, r.code, meta);
    }
    revalidateAdminSaleDetail(sid);
    revalidatePath("/admin/lots");
    return actionSuccess({ id: r.data.id });
  });
}

export async function adminPublishSaleResultAction(saleId: string): Promise<ActionResult<void>> {
  return instrumentServerAction("adminPublishSaleResultAction", async () => {
    const denied = await denyUnlessAdminCapability(SALES_ACCESS);
    if (denied) return denied;
    const id = saleId.trim();
    if (!id) {
      return actionFailure("Missing sale");
    }
    const { adminSales } = getWriteContainer();
    const r = await adminSales.publish(id);
    if (!r.ok) {
      const meta = readApiActionErrorMeta(r.body);
      return actionFailure(r.message, undefined, r.status, r.code, meta);
    }
    revalidateAdminSaleDetail(id);
    revalidatePath("/");
    return actionSuccess();
  });
}

export async function adminUnpublishSaleResultAction(saleId: string): Promise<ActionResult<void>> {
  return instrumentServerAction("adminUnpublishSaleResultAction", async () => {
    const denied = await denyUnlessAdminCapability(SALES_ACCESS);
    if (denied) return denied;
    const id = saleId.trim();
    if (!id) {
      return actionFailure("Missing sale");
    }
    const { adminSales } = getWriteContainer();
    const r = await adminSales.unpublish(id);
    if (!r.ok) {
      return actionFailure(r.message, undefined, r.status);
    }
    revalidateAdminSaleDetail(id);
    revalidatePath("/admin/lots");
    revalidatePath("/");
    return actionSuccess();
  });
}

export async function adminCancelSaleResultAction(saleId: string): Promise<ActionResult<void>> {
  return instrumentServerAction("adminCancelSaleResultAction", async () => {
    const denied = await denyUnlessAdminCapability(SALES_ACCESS);
    if (denied) return denied;
    const id = saleId.trim();
    if (!id) {
      return actionFailure("Missing sale");
    }
    const { adminSales } = getWriteContainer();
    const r = await adminSales.cancel(id, {});
    if (!r.ok) {
      return actionFailure(r.message, undefined, r.status);
    }
    revalidateAdminSaleDetail(id);
    revalidatePath("/");
    return actionSuccess();
  });
}

export async function adminSoftDeleteSaleResultAction(
  saleId: string,
  confirmationPhrase: string,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminSoftDeleteSaleResultAction", async () => {
    const denied = await denyUnlessAdminCapability(SALES_ACCESS);
    if (denied) return denied;
    const id = saleId.trim();
    const phrase = confirmationPhrase.trim();
    if (!id) {
      return actionFailure("Missing sale");
    }
    if (!phrase) {
      return actionFailure("Confirmation phrase is required");
    }
    const { adminSales } = getWriteContainer();
    const r = await adminSales.softDelete(id, phrase);
    if (!r.ok) {
      return actionFailure(r.message, undefined, r.status);
    }
    revalidatePath("/admin/sales");
    revalidatePath("/");
    return actionSuccess();
  });
}

export async function adminAttachLotToSaleResultAction(
  saleId: string,
  lotId: string,
  opts?: { via?: "attach_endpoint" | "wizard" },
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminAttachLotToSaleResultAction", async () => {
    const denied = await denyUnlessAdminCapability(LOTS_ACCESS);
    if (denied) return denied;
    const sid = saleId.trim();
    const lid = lotId.trim();
    if (!sid || !lid) {
      return actionFailure("Missing sale or lot");
    }
    const { adminSales } = getWriteContainer();
    const r = await adminSales.attachLot(sid, lid, opts?.via);
    if (!r.ok) {
      return actionFailure(r.message, undefined, r.status);
    }
    revalidateAdminSaleDetail(sid);
    revalidatePath("/admin/lots");
    return actionSuccess();
  });
}

export async function adminDetachLotFromSaleResultAction(
  saleId: string,
  lotId: string,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminDetachLotFromSaleResultAction", async () => {
    const denied = await denyUnlessAdminCapability(LOTS_ACCESS);
    if (denied) return denied;
    const sid = saleId.trim();
    const lid = lotId.trim();
    if (!sid || !lid) {
      return actionFailure("Missing sale or lot");
    }
    const { adminSales } = getWriteContainer();
    const r = await adminSales.detachLot(sid, lid);
    if (!r.ok) {
      return actionFailure(r.message, undefined, r.status);
    }
    revalidateAdminSaleDetail(sid);
    revalidatePath("/admin/lots");
    return actionSuccess();
  });
}

export async function adminMarkSaleEndedResultAction(
  saleId: string,
  reason?: string,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminMarkSaleEndedResultAction", async () => {
    const denied = await denyUnlessAdminCapability(SALES_ACCESS);
    if (denied) return denied;
    const id = saleId.trim();
    if (!id) {
      return actionFailure("Missing sale");
    }
    const { adminSales } = getWriteContainer();
    const r = await adminSales.markEnded(id, reason ? { reason } : {});
    if (!r.ok) {
      return actionFailure(r.message, undefined, r.status);
    }
    revalidateAdminSaleDetail(id);
    revalidatePath(`/sales/${id}`);
    revalidatePath("/", "layout");
    revalidatePath("/");
    return actionSuccess();
  });
}

export async function adminCancelLotInSaleResultAction(
  saleId: string,
  lotId: string,
  reason?: string,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminCancelLotInSaleResultAction", async () => {
    const denied = await denyUnlessAdminCapability(SALES_ACCESS);
    if (denied) return denied;
    const sid = saleId.trim();
    const lid = lotId.trim();
    if (!sid || !lid) {
      return actionFailure("Missing sale or lot");
    }
    const { adminSales } = getWriteContainer();
    const r = await adminSales.cancelLot(sid, lid, reason ? { reason } : {});
    if (!r.ok) {
      return actionFailure(r.message, undefined, r.status);
    }
    revalidateAdminSaleDetail(sid);
    revalidatePath("/admin/lots");
    revalidatePath(`/lot/${lid}`);
    revalidatePath("/", "layout");
    return actionSuccess();
  });
}

export async function adminSetLotStatusResultAction(
  saleId: string,
  lotId: string,
  status: LotStatus,
  reason?: string,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminSetLotStatusResultAction", async () => {
    const denied = await denyUnlessAdminCapability(SALES_ACCESS);
    if (denied) return denied;
    const sid = saleId.trim();
    const lid = lotId.trim();
    if (!sid || !lid) {
      return actionFailure("Missing sale or lot");
    }
    const { adminSales } = getWriteContainer();
    const r = await adminSales.setLotStatus(sid, lid, status, reason);
    if (!r.ok) {
      return actionFailure(r.message, undefined, r.status);
    }
    revalidateAdminSaleDetail(sid);
    revalidatePath("/admin/lots");
    revalidatePath(`/lot/${lid}`);
    revalidatePath("/", "layout");
    return actionSuccess();
  });
}
