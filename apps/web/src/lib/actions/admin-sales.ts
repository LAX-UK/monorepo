"use server";

import { instrumentServerAction } from "@/lib/observability/instrument-server-action";

import { readApiActionErrorMeta } from "@/lib/actions/_utils";
import { getIdempotentSaleCreate, setIdempotentSaleCreate } from "@/lib/actions/idempotency-cache";
import { revalidateAdminSaleDetail } from "@/lib/actions/revalidate-admin-sale-detail";
import {
  assertAdminCapabilityForRedirect,
  denyUnlessAdminCapability,
} from "@/lib/auth/assert-admin-action-capability";
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
import { redirect } from "next/navigation";
import type { z } from "zod";

function parseCoverImagesFromForm(formData: FormData): string[] | undefined {
  const raw = String(formData.get("coverImages") ?? "").trim();
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return undefined;
    const out = parsed.map((x) => String(x).trim()).filter(Boolean);
    return out.length > 0 ? out : undefined;
  } catch {
    return undefined;
  }
}

const LOCATION_FORM_FIELDS = [
  "locationName",
  "locationAddress",
  "locationMapUrl",
  "locationAddressLine1",
  "locationAddressLine2",
  "locationCity",
  "locationCounty",
  "locationPostcode",
  "locationCountry",
] as const;

type LocationFormField = (typeof LOCATION_FORM_FIELDS)[number];

function readLocationFields(formData: FormData): Record<LocationFormField, string> {
  const out = {} as Record<LocationFormField, string>;
  for (const field of LOCATION_FORM_FIELDS) {
    out[field] = String(formData.get(field) ?? "").trim();
  }
  return out;
}

function buildLocationCreatePayload(
  fields: Record<LocationFormField, string>,
  isOnsite: boolean,
): Partial<Record<LocationFormField, string | undefined>> {
  const out: Partial<Record<LocationFormField, string | undefined>> = {};
  for (const field of LOCATION_FORM_FIELDS) {
    out[field] = isOnsite ? fields[field] || undefined : undefined;
  }
  return out;
}

function buildLocationUpdatePayload(
  fields: Record<LocationFormField, string>,
  deliveryMode: "online" | "onsite" | undefined,
): Partial<Record<LocationFormField, string | null | undefined>> {
  const out: Partial<Record<LocationFormField, string | null | undefined>> = {};
  const isOnline = deliveryMode === "online";
  const isOnsite = deliveryMode === "onsite";
  for (const field of LOCATION_FORM_FIELDS) {
    if (isOnline) {
      out[field] = null;
    } else if (isOnsite) {
      out[field] = fields[field] === "" ? null : fields[field];
    } else {
      out[field] = undefined;
    }
  }
  return out;
}

export async function adminCreateSaleAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminCreateSaleAction",
    async () => {
      const denied = await assertAdminCapabilityForRedirect(SALES_ACCESS);
      if (!denied.ok) {
        redirect(`/admin/sales/new?error=${encodeURIComponent(denied.message)}`);
      }
      const cat = String(formData.get("categoryId") ?? "").trim();
      const dmRaw = String(formData.get("deliveryMode") ?? "onsite").trim();
      const deliveryMode = dmRaw === "online" || dmRaw === "onsite" ? dmRaw : "onsite";
      const streamRaw = String(formData.get("streamUrl") ?? "").trim();
      const isOnsite = deliveryMode === "onsite";
      const locationFields = readLocationFields(formData);
      const parsed = createSaleSchema.safeParse({
        title: String(formData.get("title") ?? "").trim(),
        description: String(formData.get("description") ?? "").trim() || undefined,
        coverImages: parseCoverImagesFromForm(formData),
        categoryId: cat && /^[0-9a-f-]{36}$/i.test(cat) ? cat : undefined,
        deliveryMode,
        streamUrl: isOnsite ? streamRaw || undefined : undefined,
        ...buildLocationCreatePayload(locationFields, isOnsite),
        startTime: new Date(String(formData.get("startTime") ?? "")),
        endTime: new Date(String(formData.get("endTime") ?? "")),
        previewStartTime: String(formData.get("previewStartTime") ?? "").trim()
          ? new Date(String(formData.get("previewStartTime")))
          : undefined,
        buyerPremiumRate: String(formData.get("buyerPremiumRate") ?? "").trim() || undefined,
        terms: String(formData.get("terms") ?? "").trim() || undefined,
      });
      if (!parsed.success) {
        redirect(
          `/admin/sales/new?error=${encodeURIComponent(parsed.error.issues.map((e) => e.message).join("; "))}`,
        );
      }
      const { adminSales } = getWriteContainer();
      const r = await adminSales.create(parsed.data);
      if (!r.ok) {
        redirect(`/admin/sales/new?error=${encodeURIComponent(r.message)}`);
      }
      revalidatePath("/admin/sales");
      revalidatePath("/");
      redirect(`/admin/sales/${r.data.id}`);
    },
    { formData },
  );
}

export async function adminUpdateSaleAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminUpdateSaleAction",
    async () => {
      const denied = await assertAdminCapabilityForRedirect(SALES_ACCESS);
      if (!denied.ok) {
        redirect(`/admin/sales?error=${encodeURIComponent(denied.message)}`);
      }
      const id = String(formData.get("saleId") ?? "").trim();
      if (!id) redirect(`/admin/sales?error=${encodeURIComponent("Missing sale")}`);
      const cat = String(formData.get("categoryId") ?? "").trim();
      const dmRaw = String(formData.get("deliveryMode") ?? "").trim();
      const deliveryMode = dmRaw === "online" || dmRaw === "onsite" ? dmRaw : undefined;
      const streamRaw = String(formData.get("streamUrl") ?? "").trim();
      const isOnline = deliveryMode === "online";
      const locationFields = readLocationFields(formData);
      const parsed = updateSaleSchema.safeParse({
        title: String(formData.get("title") ?? "").trim() || undefined,
        description: String(formData.get("description") ?? "").trim() || undefined,
        coverImages: parseCoverImagesFromForm(formData),
        categoryId: cat && /^[0-9a-f-]{36}$/i.test(cat) ? cat : undefined,
        deliveryMode,
        streamUrl: isOnline ? null : streamRaw === "" ? null : streamRaw || undefined,
        ...buildLocationUpdatePayload(locationFields, deliveryMode),
        startTime: String(formData.get("startTime") ?? "").trim()
          ? new Date(String(formData.get("startTime")))
          : undefined,
        endTime: String(formData.get("endTime") ?? "").trim()
          ? new Date(String(formData.get("endTime")))
          : undefined,
        previewStartTime: String(formData.get("previewStartTime") ?? "").trim()
          ? new Date(String(formData.get("previewStartTime")))
          : undefined,
        buyerPremiumRate: String(formData.get("buyerPremiumRate") ?? "").trim() || undefined,
        terms: String(formData.get("terms") ?? "").trim() || undefined,
      });
      if (!parsed.success) {
        redirect(
          `/admin/sales/${id}/edit?error=${encodeURIComponent(parsed.error.issues.map((e) => e.message).join("; "))}`,
        );
      }
      const { adminSales } = getWriteContainer();
      const r = await adminSales.update(id, parsed.data);
      if (!r.ok) {
        redirect(`/admin/sales/${id}/edit?error=${encodeURIComponent(r.message)}`);
      }
      revalidateAdminSaleDetail(id);
      revalidatePath("/");
      redirect(`/admin/sales/${id}`);
    },
    { formData },
  );
}

export async function adminPublishSaleAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminPublishSaleAction",
    async () => {
      const denied = await assertAdminCapabilityForRedirect(SALES_ACCESS);
      if (!denied.ok) {
        redirect(`/admin/sales?error=${encodeURIComponent(denied.message)}`);
      }
      const id = String(formData.get("saleId") ?? "").trim();
      if (!id) redirect(`/admin/sales?error=${encodeURIComponent("Missing sale")}`);
      const { adminSales } = getWriteContainer();
      const r = await adminSales.publish(id);
      if (!r.ok) {
        redirect(`/admin/sales/${id}?error=${encodeURIComponent(r.message)}`);
      }
      revalidateAdminSaleDetail(id);
      revalidatePath("/");
      redirect(`/admin/sales/${id}`);
    },
    { formData },
  );
}

export async function adminCancelSaleAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminCancelSaleAction",
    async () => {
      const denied = await assertAdminCapabilityForRedirect(SALES_ACCESS);
      if (!denied.ok) {
        redirect(`/admin/sales?error=${encodeURIComponent(denied.message)}`);
      }
      const id = String(formData.get("saleId") ?? "").trim();
      if (!id) redirect(`/admin/sales?error=${encodeURIComponent("Missing sale")}`);
      const { adminSales } = getWriteContainer();
      const r = await adminSales.cancel(id, {});
      if (!r.ok) {
        redirect(`/admin/sales/${id}?error=${encodeURIComponent(r.message)}`);
      }
      revalidateAdminSaleDetail(id);
      revalidatePath("/");
      redirect(`/admin/sales/${id}`);
    },
    { formData },
  );
}

export async function adminAttachLotToSaleAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminAttachLotToSaleAction",
    async () => {
      const denied = await assertAdminCapabilityForRedirect(LOTS_ACCESS);
      if (!denied.ok) {
        redirect(`/admin/sales?error=${encodeURIComponent(denied.message)}`);
      }
      const saleId = String(formData.get("saleId") ?? "").trim();
      const lotId = String(formData.get("lotId") ?? "").trim();
      if (!saleId || !lotId)
        redirect(`/admin/sales?error=${encodeURIComponent("Missing sale or lot")}`);
      const { adminSales } = getWriteContainer();
      const r = await adminSales.attachLot(saleId, lotId);
      if (!r.ok) {
        redirect(`/admin/sales/${saleId}/lots?error=${encodeURIComponent(r.message)}`);
      }
      revalidateAdminSaleDetail(saleId);
      revalidatePath("/admin/lots");
      redirect(`/admin/sales/${saleId}/lots`);
    },
    { formData },
  );
}

export async function adminDetachLotFromSaleAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "adminDetachLotFromSaleAction",
    async () => {
      const denied = await assertAdminCapabilityForRedirect(LOTS_ACCESS);
      if (!denied.ok) {
        redirect(`/admin/sales?error=${encodeURIComponent(denied.message)}`);
      }
      const saleId = String(formData.get("saleId") ?? "").trim();
      const lotId = String(formData.get("lotId") ?? "").trim();
      if (!saleId || !lotId)
        redirect(`/admin/sales?error=${encodeURIComponent("Missing sale or lot")}`);
      const { adminSales } = getWriteContainer();
      const r = await adminSales.detachLot(saleId, lotId);
      if (!r.ok) {
        redirect(`/admin/sales/${saleId}/lots?error=${encodeURIComponent(r.message)}`);
      }
      revalidateAdminSaleDetail(saleId);
      revalidatePath("/admin/lots");
      redirect(`/admin/sales/${saleId}/lots`);
    },
    { formData },
  );
}

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
