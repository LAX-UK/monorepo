"use server";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { getWriteContainer } from "@/lib/data/write-container.server";
import {
  type ActionResult,
  actionFailure,
  actionSuccess,
  firstZodErrorMessage,
  zodErrorToFieldErrors,
} from "@/lib/forms/form-result";
import {
  adminBulkEmailSuppressionsBodySchema,
  adminBulkInvitationsBodySchema,
  adminBulkSubmissionsBodySchema,
  adminBulkUsersBodySchema,
  adminCreateArtistBodySchema,
  adminCreateCategoryBodySchema,
  adminCreateInvitationBodySchema,
  adminSetRoleBodySchema,
  adminSuspendBodySchema,
  adminUpdateArtistBodySchema,
  adminUpdateCategoryBodySchema,
  bulkLotsBodySchema,
  cancelLotBodySchema,
  createLotSchema,
  invitationIdUuidParamSchema,
  updateLotMarketingDetailsSchema,
  updateLotSchema,
} from "@auction/validators";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

async function postBulkAction(
  path: string,
  body: unknown,
  fallback: string,
): Promise<ActionResult<void>> {
  const res = await authedServerFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    return actionFailure(payload.error ?? fallback, undefined, res.status);
  }
  return actionSuccess();
}

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
    sellerId: String(formData.get("sellerId") ?? "").trim() || undefined,
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
    sellerId: String(formData.get("sellerId") ?? "").trim() || undefined,
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

export async function adminCreateCategoryResultAction(
  input: z.infer<typeof adminCreateCategoryBodySchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = adminCreateCategoryBodySchema.safeParse(input);
  if (!parsed.success) {
    return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
  }
  const { adminCategories } = getWriteContainer();
  const r = await adminCategories.create(parsed.data);
  if (!r.ok) {
    return actionFailure(r.message, undefined, r.status);
  }
  revalidatePath("/admin/categories");
  return actionSuccess({ id: r.data.id });
}

export async function adminUpdateCategoryResultAction(
  categoryId: string,
  input: z.infer<typeof adminUpdateCategoryBodySchema>,
): Promise<ActionResult<void>> {
  const id = categoryId.trim();
  if (!id) return actionFailure("Missing category");
  const parsed = adminUpdateCategoryBodySchema.safeParse(input);
  if (!parsed.success) {
    return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
  }
  const { adminCategories } = getWriteContainer();
  const r = await adminCategories.update(id, parsed.data);
  if (!r.ok) {
    return actionFailure(r.message, undefined, r.status);
  }
  revalidatePath("/admin/categories");
  revalidatePath(`/admin/categories/${id}/edit`);
  return actionSuccess();
}

export async function adminArchiveCategoryResultAction(
  categoryId: string,
): Promise<ActionResult<void>> {
  const id = categoryId.trim();
  if (!id) return actionFailure("Missing category");
  const { adminCategories } = getWriteContainer();
  const r = await adminCategories.archive(id);
  if (!r.ok) {
    return actionFailure(r.message, undefined, r.status);
  }
  revalidatePath("/admin/categories");
  revalidatePath(`/admin/categories/${id}/edit`);
  return actionSuccess();
}

export async function adminDeleteCategoryResultAction(
  categoryId: string,
): Promise<ActionResult<void>> {
  const id = categoryId.trim();
  if (!id) return actionFailure("Missing category");
  const { adminCategories } = getWriteContainer();
  const r = await adminCategories.delete(id);
  if (!r.ok) {
    return actionFailure(r.message, undefined, r.status);
  }
  revalidatePath("/admin/categories");
  return actionSuccess();
}

export async function adminCreateArtistResultAction(
  input: z.infer<typeof adminCreateArtistBodySchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = adminCreateArtistBodySchema.safeParse(input);
  if (!parsed.success) {
    return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
  }
  const { adminArtists } = getWriteContainer();
  const r = await adminArtists.create(parsed.data);
  if (!r.ok) return actionFailure(r.message, undefined, r.status);
  revalidatePath("/admin/artists");
  return actionSuccess({ id: r.data.id });
}

const mergeArtistPhraseSchema = z.object({
  intoArtistId: z.string().uuid(),
  reason: z.string().trim().min(10).max(1000),
  confirmationPhrase: z.string().min(1).max(500),
});

export async function adminMergeArtistResultAction(
  fromArtistId: string,
  input: z.infer<typeof mergeArtistPhraseSchema>,
): Promise<ActionResult<{ remainingId: string }>> {
  const fromId = fromArtistId.trim();
  if (!fromId) return actionFailure("Missing artist");

  const parsed = mergeArtistPhraseSchema.safeParse(input);
  if (!parsed.success) {
    return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
  }
  if (parsed.data.intoArtistId === fromId) {
    return actionFailure("Cannot merge an artist into itself");
  }

  const canonRes = await authedServerFetch(`/artists/${encodeURIComponent(parsed.data.intoArtistId)}`);
  if (!canonRes.ok) {
    return actionFailure("Target artist not found", undefined, canonRes.status);
  }
  const canonBody = (await canonRes.json()) as { data?: { displayName?: string } };
  const displayName = canonBody.data?.displayName;
  if (!displayName) {
    return actionFailure("Target artist not found");
  }
  const expected = `MERGE INTO ${displayName}`;
  if (parsed.data.confirmationPhrase !== expected) {
    return actionFailure("Confirmation phrase does not match — type it exactly as shown.");
  }

  const mergeRes = await authedServerFetch(`/artists/${encodeURIComponent(fromId)}/merge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      intoArtistId: parsed.data.intoArtistId,
      reason: parsed.data.reason,
      confirmationPhrase: parsed.data.confirmationPhrase,
    }),
  });
  if (!mergeRes.ok) {
    const payload = (await mergeRes.json().catch(() => ({}))) as { error?: string; message?: string };
    return actionFailure(payload.message ?? payload.error ?? "merge_failed", undefined, mergeRes.status);
  }

  const body = (await mergeRes.json()) as {
    data?: { remaining?: { id?: string }; canonical?: { id?: string } };
  };
  const remainingId = body.data?.remaining?.id ?? body.data?.canonical?.id ?? parsed.data.intoArtistId;

  revalidatePath("/admin/artists");
  revalidatePath(`/admin/artists/${fromId}/edit`);
  revalidatePath(`/admin/artists/${remainingId}/edit`);
  return actionSuccess({ remainingId });
}

export async function adminUpdateArtistResultAction(
  artistId: string,
  input: z.infer<typeof adminUpdateArtistBodySchema>,
): Promise<ActionResult<void>> {
  const id = artistId.trim();
  if (!id) return actionFailure("Missing artist");
  const parsed = adminUpdateArtistBodySchema.safeParse(input);
  if (!parsed.success) {
    return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
  }
  const { adminArtists } = getWriteContainer();
  const r = await adminArtists.update(id, parsed.data);
  if (!r.ok) return actionFailure(r.message, undefined, r.status);
  revalidatePath("/admin/artists");
  revalidatePath(`/admin/artists/${id}/edit`);
  return actionSuccess();
}

export async function adminUpdateLotMarketingDetailsResultAction(
  lotId: string,
  input: z.infer<typeof updateLotMarketingDetailsSchema>,
): Promise<ActionResult<void>> {
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

export async function adminBulkUsersResultAction(
  body: z.infer<typeof adminBulkUsersBodySchema>,
): Promise<ActionResult<void>> {
  const parsed = adminBulkUsersBodySchema.safeParse(body);
  if (!parsed.success) {
    return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
  }
  const result = await postBulkAction("/admin/users/bulk", parsed.data, "User bulk action failed");
  if (!result.ok) return result;
  revalidatePath("/admin/users");
  return actionSuccess();
}

export async function adminBulkInvitationsResultAction(
  body: z.infer<typeof adminBulkInvitationsBodySchema>,
): Promise<ActionResult<void>> {
  const parsed = adminBulkInvitationsBodySchema.safeParse(body);
  if (!parsed.success) {
    return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
  }
  const result = await postBulkAction(
    "/admin/invitations/bulk",
    parsed.data,
    "Invitation bulk action failed",
  );
  if (!result.ok) return result;
  revalidatePath("/admin/invitations");
  return actionSuccess();
}

export async function adminBulkEmailSuppressionsResultAction(
  body: z.infer<typeof adminBulkEmailSuppressionsBodySchema>,
): Promise<ActionResult<void>> {
  const parsed = adminBulkEmailSuppressionsBodySchema.safeParse(body);
  if (!parsed.success) {
    return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
  }
  const result = await postBulkAction(
    "/admin/email/suppressions/bulk",
    parsed.data,
    "Email suppression bulk action failed",
  );
  if (!result.ok) return result;
  revalidatePath("/admin/email/suppressions");
  return actionSuccess();
}

export async function adminBulkSubmissionsResultAction(
  body: z.infer<typeof adminBulkSubmissionsBodySchema>,
): Promise<ActionResult<void>> {
  const parsed = adminBulkSubmissionsBodySchema.safeParse(body);
  if (!parsed.success) {
    return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
  }
  const result = await postBulkAction(
    "/submissions/bulk",
    parsed.data,
    "Submission bulk action failed",
  );
  if (!result.ok) return result;
  revalidatePath("/admin/submissions");
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

export async function adminPaymentXeroSyncResultAction(
  paymentId: string,
): Promise<ActionResult<void>> {
  const id = paymentId.trim();
  if (!id) {
    return actionFailure("Missing payment");
  }
  const { adminPayments } = getWriteContainer();
  const r = await adminPayments.xeroSync(id);
  if (!r.ok) {
    return actionFailure(r.message, undefined, r.status);
  }
  if (!r.data.ok) {
    return actionFailure(r.data.error ?? "Xero sync failed");
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

export async function adminXeroOAuthStartAction(): Promise<void> {
  const res = await authedServerFetch("/admin/integrations/xero/oauth/consent-url");
  if (!res.ok) {
    redirect(`/admin/integrations/xero?error=${encodeURIComponent("Could not start Xero OAuth")}`);
  }
  const body = (await res.json()) as { data: { url: string } };
  redirect(body.data.url);
}

export async function adminXeroDisconnectAction(): Promise<void> {
  const res = await authedServerFetch("/admin/integrations/xero/disconnect", { method: "POST" });
  if (!res.ok) {
    redirect(`/admin/integrations/xero?error=${encodeURIComponent("Disconnect failed")}`);
  }
  revalidatePath("/admin/integrations/xero");
  redirect("/admin/integrations/xero");
}

export async function adminCreateInvitationResultAction(
  values: unknown,
): Promise<ActionResult<void>> {
  const parsed = adminCreateInvitationBodySchema.safeParse(values);
  if (!parsed.success) {
    return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
  }
  const res = await authedServerFetch("/admin/invitations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    return actionFailure(payload.error ?? "Could not create invite", undefined, res.status);
  }
  revalidatePath("/admin/invitations");
  return actionSuccess();
}

export async function adminCreateInvitationAction(formData: FormData): Promise<void> {
  const r = await adminCreateInvitationResultAction({
    email: String(formData.get("email") ?? "").trim(),
    targetRole: String(formData.get("targetRole") ?? "").trim(),
  });
  if (!r.ok) {
    redirect(`/admin/invitations?error=${encodeURIComponent(r.error)}`);
  }
  redirect("/admin/invitations");
}

export async function adminRevokeInvitationAction(formData: FormData): Promise<void> {
  const id = String(formData.get("invitationId") ?? "").trim();
  const p = invitationIdUuidParamSchema.safeParse({ invitationId: id });
  if (!p.success) {
    redirect(`/admin/invitations?error=${encodeURIComponent("Invalid invitation")}`);
  }
  const res = await authedServerFetch(`/admin/invitations/${p.data.invitationId}/revoke`, {
    method: "POST",
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    redirect(`/admin/invitations?error=${encodeURIComponent(payload.error ?? "Could not revoke")}`);
  }
  revalidatePath("/admin/invitations");
  redirect("/admin/invitations");
}

export async function adminResendInvitationAction(formData: FormData): Promise<void> {
  const id = String(formData.get("invitationId") ?? "").trim();
  const p = invitationIdUuidParamSchema.safeParse({ invitationId: id });
  if (!p.success) {
    redirect(`/admin/invitations?error=${encodeURIComponent("Invalid invitation")}`);
  }
  const res = await authedServerFetch(`/admin/invitations/${p.data.invitationId}/resend`, {
    method: "POST",
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    redirect(`/admin/invitations?error=${encodeURIComponent(payload.error ?? "Could not resend")}`);
  }
  revalidatePath("/admin/invitations");
  redirect("/admin/invitations");
}
