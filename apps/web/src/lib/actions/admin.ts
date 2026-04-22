"use server";

import {
  actionFailure,
  actionSuccess,
  firstZodErrorMessage,
  type ActionResult,
  zodErrorToFieldErrors,
} from "@/lib/forms/form-result";
import { getWriteContainer } from "@/lib/data/write-container.server";
import {
  adminSetRoleBodySchema,
  adminSuspendBodySchema,
  bulkLotsBodySchema,
  cancelLotBodySchema,
  createLotSchema,
  updateLotSchema,
} from "@auction/validators";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";

export async function adminBulkLotsAction(formData: FormData): Promise<void> {
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
  const { adminLots } = getWriteContainer();
  const r = await adminLots.bulk(parsed.data);
  if (!r.ok) {
    redirect(`/admin/lots?error=${encodeURIComponent(r.message)}`);
  }
  revalidatePath("/admin/lots");
  redirect("/admin/lots");
}

export async function adminPublishLotAction(formData: FormData): Promise<void> {
  const id = String(formData.get("lotId") ?? "").trim();
  if (!id) redirect(`/admin/lots?error=${encodeURIComponent("Missing lot")}`);
  const { adminLots } = getWriteContainer();
  const r = await adminLots.publish(id);
  if (!r.ok) {
    redirect(`/admin/lots/${id}?error=${encodeURIComponent(r.message)}`);
  }
  revalidatePath("/admin/lots");
  revalidatePath(`/admin/lots/${id}`);
  redirect(`/admin/lots/${id}`);
}

export async function adminCancelLotAction(formData: FormData): Promise<void> {
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
  revalidatePath("/admin/lots");
  revalidatePath(`/admin/lots/${id}`);
  redirect(`/admin/lots/${id}`);
}

export async function adminRefundPaymentAction(formData: FormData): Promise<void> {
  const id = String(formData.get("paymentId") ?? "").trim();
  if (!id) redirect(`/admin/payments?error=${encodeURIComponent("Missing payment")}`);
  const { adminPayments } = getWriteContainer();
  const r = await adminPayments.refund(id);
  if (!r.ok) {
    redirect(`/admin/payments?error=${encodeURIComponent(r.message)}`);
  }
  revalidatePath("/admin/payments");
  redirect("/admin/payments");
}

export async function adminCapturePaymentAction(formData: FormData): Promise<void> {
  const id = String(formData.get("paymentId") ?? "").trim();
  if (!id) redirect(`/admin/payments?error=${encodeURIComponent("Missing payment")}`);
  const { adminPayments } = getWriteContainer();
  const r = await adminPayments.capture(id);
  if (!r.ok) {
    redirect(`/admin/payments?error=${encodeURIComponent(r.message)}`);
  }
  revalidatePath("/admin/payments");
  redirect("/admin/payments");
}

export async function adminSuspendUserAction(formData: FormData): Promise<void> {
  const id = String(formData.get("userId") ?? "").trim();
  if (!id) redirect(`/admin/users?error=${encodeURIComponent("Missing user")}`);
  const { adminUsers } = getWriteContainer();
  const r = await adminUsers.suspend(id, {
    reason: String(formData.get("reason") ?? "").trim() || undefined,
  });
  if (!r.ok) {
    redirect(`/admin/users?error=${encodeURIComponent(r.message)}`);
  }
  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function adminUnsuspendUserAction(formData: FormData): Promise<void> {
  const id = String(formData.get("userId") ?? "").trim();
  if (!id) redirect(`/admin/users?error=${encodeURIComponent("Missing user")}`);
  const { adminUsers } = getWriteContainer();
  const r = await adminUsers.unsuspend(id);
  if (!r.ok) {
    redirect(`/admin/users?error=${encodeURIComponent(r.message)}`);
  }
  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function adminSetUserRoleAction(formData: FormData): Promise<void> {
  const id = String(formData.get("userId") ?? "").trim();
  const roleRaw = String(formData.get("role") ?? "").trim();
  const bodyParsed = adminSetRoleBodySchema.safeParse({ role: roleRaw });
  if (!id || !bodyParsed.success)
    redirect(`/admin/users?error=${encodeURIComponent("Missing fields")}`);
  const { adminUsers } = getWriteContainer();
  const r = await adminUsers.setRole(id, bodyParsed.data);
  if (!r.ok) {
    redirect(`/admin/users?error=${encodeURIComponent(r.message)}`);
  }
  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function adminCreateLotAction(formData: FormData): Promise<void> {
  const startRaw = String(formData.get("startTime") ?? "");
  const endRaw = String(formData.get("endTime") ?? "");
  const dutchInterval = String(formData.get("dutchDecrementIntervalMs") ?? "").trim();
  const parsed = createLotSchema.safeParse({
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || undefined,
    medium: String(formData.get("medium") ?? "").trim() || undefined,
    dimensions: String(formData.get("dimensions") ?? "").trim() || undefined,
    categoryId: String(formData.get("categoryId") ?? "").trim(),
    auctionType: String(formData.get("auctionType") ?? "english"),
    startingPrice: String(formData.get("startingPrice") ?? "").trim(),
    reservePrice: String(formData.get("reservePrice") ?? "").trim() || undefined,
    buyNowPrice: String(formData.get("buyNowPrice") ?? "").trim() || undefined,
    buyerPremiumRate: String(formData.get("buyerPremiumRate") ?? "").trim() || undefined,
    minBidIncrement: String(formData.get("minBidIncrement") ?? "").trim() || undefined,
    dutchDecrementAmount: String(formData.get("dutchDecrementAmount") ?? "").trim() || undefined,
    dutchDecrementIntervalMs: dutchInterval ? Number.parseInt(dutchInterval, 10) : undefined,
    startTime: new Date(startRaw),
    endTime: new Date(endRaw),
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
}

export async function adminUpdateLotAction(formData: FormData): Promise<void> {
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
    categoryId: String(formData.get("categoryId") ?? "").trim() || undefined,
    auctionType: String(formData.get("auctionType") ?? "").trim() || undefined,
    startingPrice: String(formData.get("startingPrice") ?? "").trim() || undefined,
    reservePrice: String(formData.get("reservePrice") ?? "").trim() || undefined,
    buyNowPrice: String(formData.get("buyNowPrice") ?? "").trim() || undefined,
    buyerPremiumRate: String(formData.get("buyerPremiumRate") ?? "").trim() || undefined,
    minBidIncrement: String(formData.get("minBidIncrement") ?? "").trim() || undefined,
    dutchDecrementAmount: String(formData.get("dutchDecrementAmount") ?? "").trim() || undefined,
    dutchDecrementIntervalMs: dutchInterval ? Number.parseInt(dutchInterval, 10) : undefined,
    startTime: startRaw ? new Date(startRaw) : undefined,
    endTime: endRaw ? new Date(endRaw) : undefined,
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
}

export async function adminCreateLotResultAction(
  input: z.infer<typeof createLotSchema>,
): Promise<ActionResult<{ id: string }>> {
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
    return actionFailure(r.message, undefined, r.status);
  }
  revalidatePath("/admin/lots");
  return actionSuccess({ id: r.data.id });
}

export async function adminUpdateLotResultAction(
  lotId: string,
  input: z.infer<typeof updateLotSchema>,
): Promise<ActionResult<void>> {
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
  const { adminLots } = getWriteContainer();
  const r = await adminLots.update(id, parsed.data);
  if (!r.ok) {
    return actionFailure(r.message, undefined, r.status);
  }
  revalidatePath("/admin/lots");
  revalidatePath(`/admin/lots/${id}`);
  return actionSuccess();
}

export async function adminPublishLotResultAction(lotId: string): Promise<ActionResult<void>> {
  const id = lotId.trim();
  if (!id) {
    return actionFailure("Missing lot");
  }
  const { adminLots } = getWriteContainer();
  const r = await adminLots.publish(id);
  if (!r.ok) {
    return actionFailure(r.message, undefined, r.status);
  }
  revalidatePath("/admin/lots");
  revalidatePath(`/admin/lots/${id}`);
  return actionSuccess();
}

export async function adminCancelLotResultAction(
  lotId: string,
  body: z.infer<typeof cancelLotBodySchema>,
): Promise<ActionResult<void>> {
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
}

export async function adminBulkLotsResultAction(
  body: z.infer<typeof bulkLotsBodySchema>,
): Promise<ActionResult<void>> {
  const parsed = bulkLotsBodySchema.safeParse(body);
  if (!parsed.success) {
    return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
  }
  const { adminLots } = getWriteContainer();
  const r = await adminLots.bulk(parsed.data);
  if (!r.ok) {
    return actionFailure(r.message, undefined, r.status);
  }
  revalidatePath("/admin/lots");
  return actionSuccess();
}

export async function adminCapturePaymentResultAction(
  paymentId: string,
): Promise<ActionResult<void>> {
  const id = paymentId.trim();
  if (!id) {
    return actionFailure("Missing payment");
  }
  const { adminPayments } = getWriteContainer();
  const r = await adminPayments.capture(id);
  if (!r.ok) {
    return actionFailure(r.message, undefined, r.status);
  }
  revalidatePath("/admin/payments");
  return actionSuccess();
}

export async function adminRefundPaymentResultAction(
  paymentId: string,
): Promise<ActionResult<void>> {
  const id = paymentId.trim();
  if (!id) {
    return actionFailure("Missing payment");
  }
  const { adminPayments } = getWriteContainer();
  const r = await adminPayments.refund(id);
  if (!r.ok) {
    return actionFailure(r.message, undefined, r.status);
  }
  revalidatePath("/admin/payments");
  return actionSuccess();
}

export async function adminSetUserRoleResultAction(
  userId: string,
  body: z.infer<typeof adminSetRoleBodySchema>,
): Promise<ActionResult<void>> {
  const id = userId.trim();
  if (!id) {
    return actionFailure("Missing user");
  }
  const p = adminSetRoleBodySchema.safeParse(body);
  if (!p.success) {
    return actionFailure(firstZodErrorMessage(p.error), zodErrorToFieldErrors(p.error));
  }
  const { adminUsers } = getWriteContainer();
  const r = await adminUsers.setRole(id, p.data);
  if (!r.ok) {
    return actionFailure(r.message, undefined, r.status);
  }
  revalidatePath("/admin/users");
  return actionSuccess();
}

export async function adminSuspendUserResultAction(
  userId: string,
  body: z.infer<typeof adminSuspendBodySchema>,
): Promise<ActionResult<void>> {
  const id = userId.trim();
  if (!id) {
    return actionFailure("Missing user");
  }
  const p = adminSuspendBodySchema.safeParse(body);
  if (!p.success) {
    return actionFailure(firstZodErrorMessage(p.error), zodErrorToFieldErrors(p.error));
  }
  const { adminUsers } = getWriteContainer();
  const r = await adminUsers.suspend(id, p.data);
  if (!r.ok) {
    return actionFailure(r.message, undefined, r.status);
  }
  revalidatePath("/admin/users");
  return actionSuccess();
}

export async function adminUnsuspendUserResultAction(userId: string): Promise<ActionResult<void>> {
  const id = userId.trim();
  if (!id) {
    return actionFailure("Missing user");
  }
  const { adminUsers } = getWriteContainer();
  const r = await adminUsers.unsuspend(id);
  if (!r.ok) {
    return actionFailure(r.message, undefined, r.status);
  }
  revalidatePath("/admin/users");
  return actionSuccess();
}
