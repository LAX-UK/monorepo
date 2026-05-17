"use server";

import { readApiActionErrorMeta } from "@/lib/actions/_utils";
import { getWriteContainer } from "@/lib/data/write-container.server";
import {
  type ActionResult,
  actionFailure,
  actionSuccess,
  firstZodErrorMessage,
  zodErrorToFieldErrors,
} from "@/lib/forms/form-result";
import type { LotStatus } from "@auction/types";
import { createSaleSchema, updateSaleSchema } from "@auction/validators";
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
}

export async function adminUpdateSaleAction(formData: FormData): Promise<void> {
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
  revalidatePath("/admin/sales");
  revalidatePath(`/admin/sales/${id}`);
  revalidatePath("/");
  redirect(`/admin/sales/${id}`);
}

export async function adminPublishSaleAction(formData: FormData): Promise<void> {
  const id = String(formData.get("saleId") ?? "").trim();
  if (!id) redirect(`/admin/sales?error=${encodeURIComponent("Missing sale")}`);
  const { adminSales } = getWriteContainer();
  const r = await adminSales.publish(id);
  if (!r.ok) {
    redirect(`/admin/sales/${id}?error=${encodeURIComponent(r.message)}`);
  }
  revalidatePath("/admin/sales");
  revalidatePath(`/admin/sales/${id}`);
  revalidatePath("/");
  redirect(`/admin/sales/${id}`);
}

export async function adminCancelSaleAction(formData: FormData): Promise<void> {
  const id = String(formData.get("saleId") ?? "").trim();
  if (!id) redirect(`/admin/sales?error=${encodeURIComponent("Missing sale")}`);
  const { adminSales } = getWriteContainer();
  const r = await adminSales.cancel(id, {});
  if (!r.ok) {
    redirect(`/admin/sales/${id}?error=${encodeURIComponent(r.message)}`);
  }
  revalidatePath("/admin/sales");
  revalidatePath(`/admin/sales/${id}`);
  revalidatePath("/");
  redirect(`/admin/sales/${id}`);
}

export async function adminAttachLotToSaleAction(formData: FormData): Promise<void> {
  const saleId = String(formData.get("saleId") ?? "").trim();
  const lotId = String(formData.get("lotId") ?? "").trim();
  if (!saleId || !lotId)
    redirect(`/admin/sales?error=${encodeURIComponent("Missing sale or lot")}`);
  const { adminSales } = getWriteContainer();
  const r = await adminSales.attachLot(saleId, lotId);
  if (!r.ok) {
    redirect(`/admin/sales/${saleId}?error=${encodeURIComponent(r.message)}`);
  }
  revalidatePath("/admin/sales");
  revalidatePath(`/admin/sales/${saleId}`);
  revalidatePath("/admin/lots");
  redirect(`/admin/sales/${saleId}`);
}

export async function adminDetachLotFromSaleAction(formData: FormData): Promise<void> {
  const saleId = String(formData.get("saleId") ?? "").trim();
  const lotId = String(formData.get("lotId") ?? "").trim();
  if (!saleId || !lotId)
    redirect(`/admin/sales?error=${encodeURIComponent("Missing sale or lot")}`);
  const { adminSales } = getWriteContainer();
  const r = await adminSales.detachLot(saleId, lotId);
  if (!r.ok) {
    redirect(`/admin/sales/${saleId}?error=${encodeURIComponent(r.message)}`);
  }
  revalidatePath("/admin/sales");
  revalidatePath(`/admin/sales/${saleId}`);
  revalidatePath("/admin/lots");
  redirect(`/admin/sales/${saleId}`);
}

export async function adminCreateSaleResultAction(
  input: z.infer<typeof createSaleSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createSaleSchema.safeParse(input);
  if (!parsed.success) {
    return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
  }
  const { adminSales } = getWriteContainer();
  const r = await adminSales.create(parsed.data);
  if (!r.ok) {
    return actionFailure(r.message, undefined, r.status);
  }
  revalidatePath("/admin/sales");
  revalidatePath("/");
  return actionSuccess({ id: r.data.id });
}

export async function adminUpdateSaleResultAction(
  saleId: string,
  input: z.infer<typeof updateSaleSchema>,
): Promise<ActionResult<void>> {
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
  revalidatePath("/admin/sales");
  revalidatePath(`/admin/sales/${id}`);
  revalidatePath("/");
  return actionSuccess();
}

export async function adminPublishSaleResultAction(saleId: string): Promise<ActionResult<void>> {
  const id = saleId.trim();
  if (!id) {
    return actionFailure("Missing sale");
  }
  const { adminSales } = getWriteContainer();
  const r = await adminSales.publish(id);
  if (!r.ok) {
    return actionFailure(r.message, undefined, r.status);
  }
  revalidatePath("/admin/sales");
  revalidatePath(`/admin/sales/${id}`);
  revalidatePath("/");
  return actionSuccess();
}

export async function adminUnpublishSaleResultAction(saleId: string): Promise<ActionResult<void>> {
  const id = saleId.trim();
  if (!id) {
    return actionFailure("Missing sale");
  }
  const { adminSales } = getWriteContainer();
  const r = await adminSales.unpublish(id);
  if (!r.ok) {
    return actionFailure(r.message, undefined, r.status);
  }
  revalidatePath("/admin/sales");
  revalidatePath(`/admin/sales/${id}`);
  revalidatePath("/admin/lots");
  revalidatePath("/");
  return actionSuccess();
}

export async function adminCancelSaleResultAction(saleId: string): Promise<ActionResult<void>> {
  const id = saleId.trim();
  if (!id) {
    return actionFailure("Missing sale");
  }
  const { adminSales } = getWriteContainer();
  const r = await adminSales.cancel(id, {});
  if (!r.ok) {
    return actionFailure(r.message, undefined, r.status);
  }
  revalidatePath("/admin/sales");
  revalidatePath(`/admin/sales/${id}`);
  revalidatePath("/");
  return actionSuccess();
}

export async function adminAttachLotToSaleResultAction(
  saleId: string,
  lotId: string,
): Promise<ActionResult<void>> {
  const sid = saleId.trim();
  const lid = lotId.trim();
  if (!sid || !lid) {
    return actionFailure("Missing sale or lot");
  }
  const { adminSales } = getWriteContainer();
  const r = await adminSales.attachLot(sid, lid);
  if (!r.ok) {
    return actionFailure(r.message, undefined, r.status);
  }
  revalidatePath("/admin/sales");
  revalidatePath(`/admin/sales/${sid}`);
  revalidatePath("/admin/lots");
  return actionSuccess();
}

export async function adminDetachLotFromSaleResultAction(
  saleId: string,
  lotId: string,
): Promise<ActionResult<void>> {
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
  revalidatePath("/admin/sales");
  revalidatePath(`/admin/sales/${sid}`);
  revalidatePath("/admin/lots");
  return actionSuccess();
}

export async function adminMarkSaleEndedResultAction(
  saleId: string,
  reason?: string,
): Promise<ActionResult<void>> {
  const id = saleId.trim();
  if (!id) {
    return actionFailure("Missing sale");
  }
  const { adminSales } = getWriteContainer();
  const r = await adminSales.markEnded(id, reason ? { reason } : {});
  if (!r.ok) {
    return actionFailure(r.message, undefined, r.status);
  }
  revalidatePath("/admin/sales");
  revalidatePath(`/admin/sales/${id}`);
  revalidatePath(`/sales/${id}`);
  revalidatePath("/", "layout");
  revalidatePath("/");
  return actionSuccess();
}

export async function adminCancelLotInSaleResultAction(
  saleId: string,
  lotId: string,
  reason?: string,
): Promise<ActionResult<void>> {
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
  revalidatePath("/admin/sales");
  revalidatePath(`/admin/sales/${sid}`);
  revalidatePath("/admin/lots");
  revalidatePath(`/lot/${lid}`);
  revalidatePath("/", "layout");
  return actionSuccess();
}

export async function adminSetLotStatusResultAction(
  saleId: string,
  lotId: string,
  status: LotStatus,
  reason?: string,
): Promise<ActionResult<void>> {
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
  revalidatePath("/admin/sales");
  revalidatePath(`/admin/sales/${sid}`);
  revalidatePath("/admin/lots");
  revalidatePath(`/lot/${lid}`);
  revalidatePath("/", "layout");
  return actionSuccess();
}
