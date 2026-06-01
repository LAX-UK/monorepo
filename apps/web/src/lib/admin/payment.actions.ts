"use server";

import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { normalizeApiErrorMessage } from "@auction/validators";

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

function releaseBlockedMessage(code: string | undefined): string | null {
  switch (code) {
    case "payment_release_blocked_aml_hold":
      return "Cannot release: buyer is on an AML/sanctions hold. Clear the screening in Compliance → AML screening first.";
    case "payment_release_blocked_source_of_funds":
      return "Cannot release: Source of Funds review is required. Approve the case in Compliance → Source of Funds first.";
    default:
      return null;
  }
}

async function jsonOrError(res: Response, fallback: string): Promise<string | null> {
  if (res.ok) return null;
  let message = fallback;
  try {
    const body = (await res.json()) as { error?: unknown; code?: string };
    if (body && typeof body.error === "object" && body.error !== null) {
      const errObj = body.error as { code?: string; message?: string };
      const blocked = releaseBlockedMessage(errObj.code);
      if (blocked) return blocked;
      message = errObj.message ?? normalizeApiErrorMessage(body.error, message);
    } else {
      const blocked = releaseBlockedMessage(
        typeof body.error === "string" ? body.error : body.code,
      );
      if (blocked) return blocked;
      message = normalizeApiErrorMessage(body.error, message);
    }
  } catch {
    // Keep fallback when the API did not return JSON.
  }
  return `${message} (${res.status})`;
}

export async function captureManualReviewPaymentAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "captureManualReviewPaymentAction",
    async () => {
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
    },
    { formData },
  );
}

export async function refundManualReviewPaymentAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "refundManualReviewPaymentAction",
    async () => {
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
    },
    { formData },
  );
}
