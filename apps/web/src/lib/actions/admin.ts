"use server";

import { readApiError } from "@/lib/actions/_utils";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { createLotSchema, updateLotSchema } from "@auction/validators";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function adminBulkLotsAction(formData: FormData): Promise<void> {
  const raw = String(formData.get("payload") ?? "").trim();
  let parsed: { ids: string[]; op: "publish" | "cancel" };
  try {
    parsed = JSON.parse(raw) as { ids: string[]; op: "publish" | "cancel" };
  } catch {
    redirect(`/admin/lots?error=${encodeURIComponent("Invalid bulk payload")}`);
  }
  if (!Array.isArray(parsed.ids) || parsed.ids.length === 0) {
    redirect(`/admin/lots?error=${encodeURIComponent("No lots selected")}`);
  }
  const res = await authedServerFetch("/lots/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: parsed.ids.slice(0, 50), op: parsed.op }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    redirect(`/admin/lots?error=${encodeURIComponent(readApiError(body, "Bulk operation failed"))}`);
  }
  revalidatePath("/admin/lots");
  redirect("/admin/lots");
}

export async function adminPublishLotAction(formData: FormData): Promise<void> {
  const id = String(formData.get("lotId") ?? "").trim();
  if (!id) redirect(`/admin/lots?error=${encodeURIComponent("Missing lot")}`);
  const res = await authedServerFetch(`/lots/${encodeURIComponent(id)}/publish`, {
    method: "POST",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    redirect(`/admin/lots/${id}?error=${encodeURIComponent(readApiError(body, "Publish failed"))}`);
  }
  revalidatePath("/admin/lots");
  revalidatePath(`/admin/lots/${id}`);
  redirect(`/admin/lots/${id}`);
}

export async function adminCancelLotAction(formData: FormData): Promise<void> {
  const id = String(formData.get("lotId") ?? "").trim();
  if (!id) redirect(`/admin/lots?error=${encodeURIComponent("Missing lot")}`);
  const res = await authedServerFetch(`/lots/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason: String(formData.get("reason") ?? "").trim() || undefined }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    redirect(`/admin/lots/${id}?error=${encodeURIComponent(readApiError(body, "Cancel failed"))}`);
  }
  revalidatePath("/admin/lots");
  revalidatePath(`/admin/lots/${id}`);
  redirect(`/admin/lots/${id}`);
}

export async function adminRefundPaymentAction(formData: FormData): Promise<void> {
  const id = String(formData.get("paymentId") ?? "").trim();
  if (!id) redirect(`/admin/payments?error=${encodeURIComponent("Missing payment")}`);
  const res = await authedServerFetch(`/payments/${encodeURIComponent(id)}/refund`, {
    method: "POST",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    redirect(`/admin/payments?error=${encodeURIComponent(readApiError(body, "Refund failed"))}`);
  }
  revalidatePath("/admin/payments");
  redirect("/admin/payments");
}

export async function adminCapturePaymentAction(formData: FormData): Promise<void> {
  const id = String(formData.get("paymentId") ?? "").trim();
  if (!id) redirect(`/admin/payments?error=${encodeURIComponent("Missing payment")}`);
  const res = await authedServerFetch(`/payments/${encodeURIComponent(id)}/capture`, {
    method: "POST",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    redirect(`/admin/payments?error=${encodeURIComponent(readApiError(body, "Capture failed"))}`);
  }
  revalidatePath("/admin/payments");
  redirect("/admin/payments");
}

export async function adminSuspendUserAction(formData: FormData): Promise<void> {
  const id = String(formData.get("userId") ?? "").trim();
  if (!id) redirect(`/admin/users?error=${encodeURIComponent("Missing user")}`);
  const reason = String(formData.get("reason") ?? "").trim() || undefined;
  const res = await authedServerFetch(`/admin/users/${encodeURIComponent(id)}/suspend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    redirect(`/admin/users?error=${encodeURIComponent(readApiError(body, "Suspend failed"))}`);
  }
  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function adminUnsuspendUserAction(formData: FormData): Promise<void> {
  const id = String(formData.get("userId") ?? "").trim();
  if (!id) redirect(`/admin/users?error=${encodeURIComponent("Missing user")}`);
  const res = await authedServerFetch(`/admin/users/${encodeURIComponent(id)}/unsuspend`, {
    method: "POST",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    redirect(`/admin/users?error=${encodeURIComponent(readApiError(body, "Unsuspend failed"))}`);
  }
  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function adminSetUserRoleAction(formData: FormData): Promise<void> {
  const id = String(formData.get("userId") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  if (!id || !role) redirect(`/admin/users?error=${encodeURIComponent("Missing fields")}`);
  const res = await authedServerFetch(`/admin/users/${encodeURIComponent(id)}/role`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    redirect(`/admin/users?error=${encodeURIComponent(readApiError(body, "Role update failed"))}`);
  }
  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function adminCreateLotAction(formData: FormData): Promise<void> {
  const startRaw = String(formData.get("startTime") ?? "");
  const endRaw = String(formData.get("endTime") ?? "");
  const startTime = new Date(startRaw);
  const endTime = new Date(endRaw);
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
    startTime,
    endTime,
  });
  if (!parsed.success) {
    redirect(
      `/admin/lots/new?error=${encodeURIComponent(parsed.error.issues.map((i: { message: string }) => i.message).join("; "))}`,
    );
  }

  const res = await authedServerFetch("/lots", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    redirect(`/admin/lots/new?error=${encodeURIComponent(readApiError(body, "Create failed"))}`);
  }
  const created = (body as { data?: { id?: string } }).data;
  const newId = created?.id;
  if (!newId) redirect(`/admin/lots/new?error=${encodeURIComponent("Create failed")}`);
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
      `/admin/lots/${id}/edit?error=${encodeURIComponent(parsed.error.issues.map((i: { message: string }) => i.message).join("; "))}`,
    );
  }

  const res = await authedServerFetch(`/lots/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    redirect(
      `/admin/lots/${id}/edit?error=${encodeURIComponent(readApiError(body, "Update failed"))}`,
    );
  }
  revalidatePath("/admin/lots");
  revalidatePath(`/admin/lots/${id}`);
  redirect(`/admin/lots/${id}`);
}
