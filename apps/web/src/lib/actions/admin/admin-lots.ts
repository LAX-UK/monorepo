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
import {
  assertAdminCapabilityForRedirect,
  denyUnlessAdminCapability,
} from "@/lib/auth/assert-admin-action-capability";
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
import { instantFromDatetimeFormString } from "@auction/ui/lib/datetime";
import {
  bulkLotsBodySchema,
  cancelLotBodySchema,
  createLotSchema,
  returnLotToInventoryBodySchema,
  updateLotMarketingDetailsSchema,
  updateLotSchema,
} from "@auction/validators";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";

export async function adminBulkLotsAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminBulkLotsAction",
    async () => {
      const raw = String(formData.get("payload") ?? "").trim();
      let obj: unknown;
      try {
        obj = JSON.parse(raw) as unknown;
      } catch {
        redirect(`/admin/lots?error=${encodeURIComponent("Invalid bulk payload")}`);
      }
      const parsed = bulkLotsBodySchema.safeParse(obj);
      if (!parsed.success) {
        redirect(`/admin/lots?error=${encodeURIComponent("Invalid bulk payload")}`);
      }
      const access = parsed.data.op === "cancel" ? SALES_ACCESS : LOTS_ACCESS;
      const denied = await assertAdminCapabilityForRedirect(access);
      if (!denied.ok) {
        redirect(`/admin/lots?error=${encodeURIComponent(denied.message)}`);
      }
      const { adminLots } = getWriteContainer();
      const r = await adminLots.bulk(parsed.data);
      if (!r.ok) {
        redirect(`/admin/lots?error=${encodeURIComponent(r.message)}`);
      }
      revalidatePath("/admin/lots");
      redirect("/admin/lots");
    },
    { formData },
  );
}

export async function adminPublishLotAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminPublishLotAction",
    async () => {
      const denied = await assertAdminCapabilityForRedirect(LOTS_ACCESS);
      if (!denied.ok) {
        redirect(`/admin/lots?error=${encodeURIComponent(denied.message)}`);
      }
      const id = String(formData.get("lotId") ?? "").trim();
      if (!id) redirect(`/admin/lots?error=${encodeURIComponent("Missing lot")}`);
      const { adminLots } = getWriteContainer();
      const r = await adminLots.publish(id);
      if (!r.ok) {
        const q = new URLSearchParams({ error: r.message });
        if (r.code) q.set("error_code", r.code);
        redirect(`/admin/lots/${id}?${q.toString()}`);
      }
      revalidateAdminLotDetail(id);
      redirect(`/admin/lots/${id}`);
    },
    { formData },
  );
}

export async function adminCancelLotAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminCancelLotAction",
    async () => {
      const denied = await assertAdminCapabilityForRedirect(SALES_ACCESS);
      if (!denied.ok) {
        redirect(`/admin/lots?error=${encodeURIComponent(denied.message)}`);
      }
      const id = String(formData.get("lotId") ?? "").trim();
      if (!id) redirect(`/admin/lots?error=${encodeURIComponent("Missing lot")}`);
      const body = cancelLotBodySchema.safeParse({
        reason: String(formData.get("reason") ?? "").trim() || undefined,
      });
      if (!body.success) {
        redirect(`/admin/lots/${id}?error=${encodeURIComponent("Invalid cancel form")}`);
      }
      const { adminLots } = getWriteContainer();
      const r = await adminLots.cancel(id, body.data);
      if (!r.ok) {
        redirect(`/admin/lots/${id}?error=${encodeURIComponent(r.message)}`);
      }
      revalidateAdminLotDetail(id);
      redirect(`/admin/lots/${id}`);
    },
    { formData },
  );
}

export async function adminCreateLotAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminCreateLotAction",
    async () => {
      const denied = await assertAdminCapabilityForRedirect(LOTS_ACCESS);
      if (!denied.ok) {
        redirect(`/admin/lots/new?error=${encodeURIComponent(denied.message)}`);
      }
      const startRaw = String(formData.get("startTime") ?? "");
      const endRaw = String(formData.get("endTime") ?? "");
      const dutchInterval = String(formData.get("dutchDecrementIntervalMs") ?? "").trim();
      const parsed = createLotSchema.safeParse({
        title: String(formData.get("title") ?? "").trim(),
        description: String(formData.get("description") ?? "").trim() || undefined,
        medium: String(formData.get("medium") ?? "").trim() || undefined,
        dimensions: String(formData.get("dimensions") ?? "").trim() || undefined,
        sellerId: String(formData.get("sellerId") ?? "").trim() || undefined,
        categoryId: String(formData.get("categoryId") ?? "").trim(),
        auctionType: String(formData.get("auctionType") ?? "english"),
        startingPrice: String(formData.get("startingPrice") ?? "").trim(),
        reservePrice: String(formData.get("reservePrice") ?? "").trim() || undefined,
        buyNowPrice: String(formData.get("buyNowPrice") ?? "").trim() || undefined,
        buyerPremiumRate: String(formData.get("buyerPremiumRate") ?? "").trim() || undefined,
        minBidIncrement: String(formData.get("minBidIncrement") ?? "").trim() || undefined,
        dutchDecrementAmount:
          String(formData.get("dutchDecrementAmount") ?? "").trim() || undefined,
        dutchDecrementIntervalMs: dutchInterval ? Number.parseInt(dutchInterval, 10) : undefined,
        startTime: instantFromDatetimeFormString(startRaw),
        endTime: instantFromDatetimeFormString(endRaw),
      });
      if (!parsed.success) {
        redirect(
          `/admin/lots/new?error=${encodeURIComponent(parsed.error.issues.map((i) => i.message).join("; "))}`,
        );
      }
      const { adminLots } = getWriteContainer();
      const r = await adminLots.create(parsed.data);
      if (!r.ok) {
        redirect(`/admin/lots/new?error=${encodeURIComponent(r.message)}`);
      }
      const newId = r.data.id;
      revalidatePath("/admin/lots");
      redirect(`/admin/lots/${newId}`);
    },
    { formData },
  );
}

export async function adminUpdateLotAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminUpdateLotAction",
    async () => {
      const denied = await assertAdminCapabilityForRedirect(LOTS_ACCESS);
      if (!denied.ok) {
        redirect(`/admin/lots?error=${encodeURIComponent(denied.message)}`);
      }
      const id = String(formData.get("lotId") ?? "").trim();
      if (!id) redirect(`/admin/lots?error=${encodeURIComponent("Missing lot")}`);
      const startRaw = String(formData.get("startTime") ?? "");
      const endRaw = String(formData.get("endTime") ?? "");
      const dutchInterval = String(formData.get("dutchDecrementIntervalMs") ?? "").trim();
      const parsed = updateLotSchema.safeParse({
        title: String(formData.get("title") ?? "").trim(),
        description: String(formData.get("description") ?? "").trim() || undefined,
        medium: String(formData.get("medium") ?? "").trim() || undefined,
        dimensions: String(formData.get("dimensions") ?? "").trim() || undefined,
        sellerId: String(formData.get("sellerId") ?? "").trim() || undefined,
        categoryId: String(formData.get("categoryId") ?? "").trim() || undefined,
        auctionType: String(formData.get("auctionType") ?? "").trim() || undefined,
        startingPrice: String(formData.get("startingPrice") ?? "").trim() || undefined,
        reservePrice: String(formData.get("reservePrice") ?? "").trim() || undefined,
        buyNowPrice: String(formData.get("buyNowPrice") ?? "").trim() || undefined,
        buyerPremiumRate: String(formData.get("buyerPremiumRate") ?? "").trim() || undefined,
        minBidIncrement: String(formData.get("minBidIncrement") ?? "").trim() || undefined,
        dutchDecrementAmount:
          String(formData.get("dutchDecrementAmount") ?? "").trim() || undefined,
        dutchDecrementIntervalMs: dutchInterval ? Number.parseInt(dutchInterval, 10) : undefined,
        startTime: startRaw ? instantFromDatetimeFormString(startRaw) : undefined,
        endTime: endRaw ? instantFromDatetimeFormString(endRaw) : undefined,
      });
      if (!parsed.success) {
        redirect(
          `/admin/lots/${id}/edit?error=${encodeURIComponent(parsed.error.issues.map((i) => i.message).join("; "))}`,
        );
      }
      const { adminLots } = getWriteContainer();
      const r = await adminLots.update(id, parsed.data);
      if (!r.ok) {
        redirect(`/admin/lots/${id}/edit?error=${encodeURIComponent(r.message)}`);
      }
      revalidatePath("/admin/lots");
      revalidatePath(`/admin/lots/${id}`);
      redirect(`/admin/lots/${id}`);
    },
    { formData },
  );
}

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
