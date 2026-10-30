"use server";

import { orderCommercePath } from "@/lib/checkout/order-commerce-path.server";
import { commerceErrorMessage } from "@/lib/commerce-error-message";
import { fetchShopCommerceCsrfForMutation } from "@/lib/shop-commerce-mutation.server";
import { shopCommerceRequest } from "@/lib/shop-commerce-request.server";
import {
  ORDER_PROBLEM_DETAILS_MAX_LENGTH,
  ORDER_PROBLEM_REASONS,
  type OrderProblemReason,
} from "@auction/shop-contracts";

export type ReportOrderProblemResult =
  | { kind: "sent" }
  | { kind: "closed" }
  | { kind: "error"; message: string };

/** Sends "Report a problem" for the shopper's order (an account's, or a guest's) to the staff inbox. */
export async function reportOrderProblem(
  orderId: string,
  input: { reason: OrderProblemReason; details: string },
): Promise<ReportOrderProblemResult> {
  const details = input.details.trim();
  if (
    !ORDER_PROBLEM_REASONS.includes(input.reason) ||
    !details ||
    details.length > ORDER_PROBLEM_DETAILS_MAX_LENGTH
  ) {
    return { kind: "error", message: "Check your report and try again." };
  }
  const csrf = await fetchShopCommerceCsrfForMutation();
  if (!csrf.ok) {
    return {
      kind: "error",
      message: commerceErrorMessage({ error: "csrf_failed" }, "We could not send your report."),
    };
  }
  const response = await shopCommerceRequest(
    await orderCommercePath(orderId, "problem-reports"),
    {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ reason: input.reason, details }),
    },
    { applyCookies: true, csrfToken: csrf.token },
  ).catch(() => null);
  if (!response) {
    return { kind: "error", message: "We could not send your report. Try again in a moment." };
  }
  if (response.ok) return { kind: "sent" };
  if (response.status === 409) return { kind: "closed" };
  if (response.status === 429) {
    return {
      kind: "error",
      message: "You have sent several messages in a short time. Try again later.",
    };
  }
  const body = await response.json().catch(() => ({}));
  return {
    kind: "error",
    message: commerceErrorMessage(body, "We could not send your report. Try again in a moment."),
  };
}
