"use server";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function errMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string") {
    return (body as { error: string }).error;
  }
  return fallback;
}

export async function adminPublishAuctionAction(formData: FormData): Promise<void> {
  const id = String(formData.get("auctionId") ?? "").trim();
  if (!id) redirect(`/admin/auctions?error=${encodeURIComponent("Missing auction")}`);
  const res = await authedServerFetch(`/auctions/${encodeURIComponent(id)}/publish`, { method: "POST" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    redirect(`/admin/auctions/${id}?error=${encodeURIComponent(errMessage(body, "Publish failed"))}`);
  }
  revalidatePath("/admin/auctions");
  revalidatePath(`/admin/auctions/${id}`);
  redirect(`/admin/auctions/${id}`);
}

export async function adminCancelAuctionAction(formData: FormData): Promise<void> {
  const id = String(formData.get("auctionId") ?? "").trim();
  if (!id) redirect(`/admin/auctions?error=${encodeURIComponent("Missing auction")}`);
  const res = await authedServerFetch(`/auctions/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason: String(formData.get("reason") ?? "").trim() || undefined }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    redirect(`/admin/auctions/${id}?error=${encodeURIComponent(errMessage(body, "Cancel failed"))}`);
  }
  revalidatePath("/admin/auctions");
  revalidatePath(`/admin/auctions/${id}`);
  redirect(`/admin/auctions/${id}`);
}

export async function adminRefundPaymentAction(formData: FormData): Promise<void> {
  const id = String(formData.get("paymentId") ?? "").trim();
  if (!id) redirect(`/admin/payments?error=${encodeURIComponent("Missing payment")}`);
  const res = await authedServerFetch(`/payments/${encodeURIComponent(id)}/refund`, { method: "POST" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    redirect(`/admin/payments?error=${encodeURIComponent(errMessage(body, "Refund failed"))}`);
  }
  revalidatePath("/admin/payments");
  redirect("/admin/payments");
}

export async function adminCreateAuctionAction(formData: FormData): Promise<void> {
  const title = String(formData.get("title") ?? "").trim();
  const auctionType = String(formData.get("auctionType") ?? "english");
  const startingPrice = String(formData.get("startingPrice") ?? "").trim();
  const startRaw = String(formData.get("startTime") ?? "");
  const endRaw = String(formData.get("endTime") ?? "");
  const startTime = new Date(startRaw);
  const endTime = new Date(endRaw);
  if (!title || !startingPrice || !startRaw || !endRaw || Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
    redirect(`/admin/auctions/new?error=${encodeURIComponent("Please fill required fields")}`);
  }
  const description = String(formData.get("description") ?? "").trim();
  const medium = String(formData.get("medium") ?? "").trim();
  const dimensions = String(formData.get("dimensions") ?? "").trim();
  const reservePrice = String(formData.get("reservePrice") ?? "").trim();
  const buyNowPrice = String(formData.get("buyNowPrice") ?? "").trim();
  const buyerPremiumRate = String(formData.get("buyerPremiumRate") ?? "").trim() || "0.25";
  const minBidIncrement = String(formData.get("minBidIncrement") ?? "").trim() || "1.00";
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const dutchDecrementAmount = String(formData.get("dutchDecrementAmount") ?? "").trim();
  const dutchInterval = String(formData.get("dutchDecrementIntervalMs") ?? "").trim();

  const payload: Record<string, unknown> = {
    title,
    auctionType,
    startingPrice,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    buyerPremiumRate,
    minBidIncrement,
  };
  if (description) payload.description = description;
  if (medium) payload.medium = medium;
  if (dimensions) payload.dimensions = dimensions;
  if (reservePrice) payload.reservePrice = reservePrice;
  if (buyNowPrice) payload.buyNowPrice = buyNowPrice;
  if (categoryId) payload.categoryId = categoryId;
  if (dutchDecrementAmount) payload.dutchDecrementAmount = dutchDecrementAmount;
  if (dutchInterval) {
    const n = Number.parseInt(dutchInterval, 10);
    if (Number.isFinite(n)) payload.dutchDecrementIntervalMs = n;
  }

  const res = await authedServerFetch("/auctions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    redirect(`/admin/auctions/new?error=${encodeURIComponent(errMessage(body, "Create failed"))}`);
  }
  const created = (body as { data?: { id?: string } }).data;
  const newId = created?.id;
  if (!newId) redirect(`/admin/auctions/new?error=${encodeURIComponent("Create failed")}`);
  revalidatePath("/admin/auctions");
  redirect(`/admin/auctions/${newId}`);
}

export async function adminUpdateAuctionAction(formData: FormData): Promise<void> {
  const id = String(formData.get("auctionId") ?? "").trim();
  if (!id) throw new Error("Missing auction");
  const title = String(formData.get("title") ?? "").trim();
  const auctionType = String(formData.get("auctionType") ?? "").trim();
  const startingPrice = String(formData.get("startingPrice") ?? "").trim();
  const startRaw = String(formData.get("startTime") ?? "");
  const endRaw = String(formData.get("endTime") ?? "");
  const startTime = new Date(startRaw);
  const endTime = new Date(endRaw);
  if (!title || !auctionType || !startingPrice || !startRaw || !endRaw || Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
    redirect(`/admin/auctions/${id}/edit?error=${encodeURIComponent("Please fill required fields")}`);
  }
  const description = String(formData.get("description") ?? "").trim();
  const medium = String(formData.get("medium") ?? "").trim();
  const dimensions = String(formData.get("dimensions") ?? "").trim();
  const reservePrice = String(formData.get("reservePrice") ?? "").trim();
  const buyNowPrice = String(formData.get("buyNowPrice") ?? "").trim();
  const buyerPremiumRate = String(formData.get("buyerPremiumRate") ?? "").trim() || "0.25";
  const minBidIncrement = String(formData.get("minBidIncrement") ?? "").trim() || "1.00";
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const dutchDecrementAmount = String(formData.get("dutchDecrementAmount") ?? "").trim();
  const dutchInterval = String(formData.get("dutchDecrementIntervalMs") ?? "").trim();

  const payload: Record<string, unknown> = {
    title,
    auctionType,
    startingPrice,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    buyerPremiumRate,
    minBidIncrement,
    description: description || undefined,
    medium: medium || undefined,
    dimensions: dimensions || undefined,
    reservePrice: reservePrice || undefined,
    buyNowPrice: buyNowPrice || undefined,
    categoryId: categoryId || undefined,
    dutchDecrementAmount: dutchDecrementAmount || undefined,
  };
  if (dutchInterval) {
    const n = Number.parseInt(dutchInterval, 10);
    if (Number.isFinite(n)) payload.dutchDecrementIntervalMs = n;
  }

  const res = await authedServerFetch(`/auctions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    redirect(`/admin/auctions/${id}/edit?error=${encodeURIComponent(errMessage(body, "Update failed"))}`);
  }
  revalidatePath("/admin/auctions");
  revalidatePath(`/admin/auctions/${id}`);
  redirect(`/admin/auctions/${id}`);
}
