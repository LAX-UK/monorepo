"use server";

import { getWriteContainer } from "@/lib/data/write-container.server";
import {
  type ActionResult,
  actionFailure,
  actionSuccess,
  firstZodErrorMessage,
  zodErrorToFieldErrors,
} from "@/lib/forms/form-result";
import { createSaleSchema, updateSaleSchema } from "@auction/validators";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";

function splitUrlLines(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function adminCreateSaleAction(formData: FormData): Promise<void> {
  const coverRaw = String(formData.get("coverImages") ?? "");
  const cat = String(formData.get("categoryId") ?? "").trim();
  const dmRaw = String(formData.get("deliveryMode") ?? "onsite").trim();
  const deliveryMode =
    dmRaw === "online" || dmRaw === "onsite" || dmRaw === "hybrid" ? dmRaw : "onsite";
  const streamRaw = String(formData.get("streamUrl") ?? "").trim();
  const parsed = createSaleSchema.safeParse({
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || undefined,
    coverImages: coverRaw ? splitUrlLines(coverRaw) : undefined,
    categoryId: cat && /^[0-9a-f-]{36}$/i.test(cat) ? cat : undefined,
    deliveryMode,
    streamUrl: streamRaw || undefined,
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
  const coverRaw = String(formData.get("coverImages") ?? "");
  const cat = String(formData.get("categoryId") ?? "").trim();
  const dmRaw = String(formData.get("deliveryMode") ?? "").trim();
  const deliveryMode =
    dmRaw === "online" || dmRaw === "onsite" || dmRaw === "hybrid" ? dmRaw : undefined;
  const streamRaw = String(formData.get("streamUrl") ?? "").trim();
  const parsed = updateSaleSchema.safeParse({
    title: String(formData.get("title") ?? "").trim() || undefined,
    description: String(formData.get("description") ?? "").trim() || undefined,
    coverImages: coverRaw ? splitUrlLines(coverRaw) : undefined,
    categoryId: cat && /^[0-9a-f-]{36}$/i.test(cat) ? cat : undefined,
    deliveryMode,
    streamUrl: streamRaw === "" ? null : streamRaw || undefined,
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
    return actionFailure(r.message, undefined, r.status);
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
