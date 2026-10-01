"use server";

import { commerceErrorMessage } from "@/lib/commerce-error-message";
import { fetchShopCommerceCsrfForMutation } from "@/lib/shop-commerce-mutation.server";
import { shopCommerceRequest } from "@/lib/shop-commerce-request.server";
import { redirect } from "next/navigation";

export type CancelCheckoutResult = { kind: "success" } | { kind: "error"; message: string };

export async function cancelCheckoutOrder(orderId: string): Promise<CancelCheckoutResult> {
  const trimmed = orderId.trim();
  if (!trimmed) {
    return { kind: "error", message: "Missing order reference." };
  }
  const csrf = await fetchShopCommerceCsrfForMutation();
  if (!csrf.ok) {
    return {
      kind: "error",
      message: commerceErrorMessage({ error: "csrf_failed" }, "Could not verify your session."),
    };
  }
  const response = await shopCommerceRequest(
    `/commerce/orders/${encodeURIComponent(trimmed)}/cancel`,
    {
      method: "POST",
      headers: {
        accept: "application/json",
      },
    },
    { applyCookies: true, csrfToken: csrf.token },
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    return {
      kind: "error",
      message: commerceErrorMessage(
        body,
        "Could not cancel checkout. Try again or contact support if payment already completed.",
      ),
    };
  }
  return { kind: "success" };
}

export async function cancelCheckoutOrderFormAction(formData: FormData): Promise<void> {
  const orderId = formData.get("orderId");
  const result = await cancelCheckoutOrder(typeof orderId === "string" ? orderId : "");
  if (result.kind === "error") {
    redirect(
      `/checkout/cancel?orderId=${encodeURIComponent(String(orderId ?? ""))}&error=${encodeURIComponent(result.message)}`,
    );
  }
  redirect("/basket?cancelled=1");
}

/** @deprecated Prefer cancelCheckoutOrder or cancelCheckoutOrderFormAction */
export async function abandonCheckout(orderId: string): Promise<void> {
  await cancelCheckoutOrder(orderId);
}
