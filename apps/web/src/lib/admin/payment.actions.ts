"use server";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function value(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

function redirectWith(kind: "success" | "error", message: string): never {
  redirect(`/admin/payments?manualReview=1&${kind}=${encodeURIComponent(message)}`);
}

async function jsonOrError(res: Response, fallback: string): Promise<string | null> {
  if (res.ok) return null;
  let message = fallback;
  try {
    const body = (await res.json()) as { error?: string };
    message = body.error ?? message;
  } catch {
    // Keep fallback when the API did not return JSON.
  }
  return `${message} (${res.status})`;
}

export async function captureManualReviewPaymentAction(formData: FormData): Promise<void> {
  const paymentId = value(formData, "paymentId");
  if (!paymentId) redirectWith("error", "payment_id_required");

  const res = await authedServerFetch(
    `/admin/payments/${encodeURIComponent(paymentId)}/capture-and-process`,
    { method: "POST" },
  );
  const error = await jsonOrError(res, "capture_manual_review_failed");
  if (error) redirectWith("error", error);

  revalidatePath("/admin/payments");
  redirectWith("success", "payment_released_for_capture");
}

export async function refundManualReviewPaymentAction(formData: FormData): Promise<void> {
  const paymentId = value(formData, "paymentId");
  if (!paymentId) redirectWith("error", "payment_id_required");

  const res = await authedServerFetch(
    `/admin/payments/${encodeURIComponent(paymentId)}/refund-buyer`,
    { method: "POST" },
  );
  const error = await jsonOrError(res, "refund_manual_review_failed");
  if (error) redirectWith("error", error);

  revalidatePath("/admin/payments");
  redirectWith("success", "buyer_refunded");
}
