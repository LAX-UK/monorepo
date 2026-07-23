"use server";

import { instrumentServerAction } from "@/lib/observability/instrument-server-action";

import { readApiActionErrorMeta } from "@/lib/actions/_utils";
import { getIdempotentSaleCreate, setIdempotentSaleCreate } from "@/lib/actions/idempotency-cache";
import { revalidateAdminSaleDetail } from "@/lib/actions/revalidate-admin-sale-detail";
import {
  type BulkSalesActionResult,
  bulkSalesFailureMessage,
  parseBulkSalesApiResponse,
} from "@/lib/admin/bulk-ops/sale-bulk-result";
import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { readDataEnvelope } from "@/lib/data/http/envelope";
import { getWriteContainer } from "@/lib/data/write-container.server";
import {
  type ActionResult,
  actionFailure,
  actionSuccess,
  firstZodErrorMessage,
  zodErrorToFieldErrors,
} from "@/lib/forms/form-result";
import { LOTS_ACCESS, SALES_ACCESS } from "@/lib/navigation/staff-nav-access";
import {
  bulkSalesBodySchema,
  createNestedLotForSaleSchema,
  createSaleSchema,
  updateSaleSchema,
} from "@auction/validators";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const saleRevalidateSummarySchema = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
});

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
    // Immediately bust the public sale page ISR + tagged catalogue fetch cache.
    if (parsed.data.dayImages !== undefined || parsed.data.pressCoverage !== undefined) {
      const { revalidateCatalogueCache } = await import("@/lib/actions/revalidate-catalogue");
      revalidateCatalogueCache();
      const updated = readDataEnvelope(r.data, saleRevalidateSummarySchema, `PATCH /sales/${id}`);
      const revalidateId = updated.id ?? id;
      const revalidateTitle = updated.title;
      if (revalidateId && revalidateTitle) {
        const { salePath: buildSalePath } = await import("@/lib/seo/url");
        revalidatePath(buildSalePath({ id: revalidateId, title: revalidateTitle }));
      }
    }
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

export async function adminBulkSalesResultAction(
  body: z.infer<typeof bulkSalesBodySchema>,
): Promise<ActionResult<BulkSalesActionResult>> {
  return instrumentServerAction("adminBulkSalesResultAction", async () => {
    const parsed = bulkSalesBodySchema.safeParse(body);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
    }
    const denied = await denyUnlessAdminCapability(SALES_ACCESS);
    if (denied) return denied;
    const { adminSales } = getWriteContainer();
    const r = await adminSales.bulk(parsed.data);
    if (!r.ok) {
      return actionFailure(r.message, undefined, r.status, r.code);
    }
    const bulk = parseBulkSalesApiResponse(r.data);
    if (!bulk) {
      return actionFailure("Unexpected bulk response from server");
    }
    revalidatePath("/admin/sales");
    revalidatePath("/admin/lots");
    for (const saleId of parsed.data.ids) {
      revalidateAdminSaleDetail(saleId);
    }
    if (bulk.failed >= bulk.attempted) {
      return actionFailure(bulkSalesFailureMessage(bulk), undefined, undefined, undefined, {
        bulk,
      });
    }
    return actionSuccess(bulk);
  });
}
