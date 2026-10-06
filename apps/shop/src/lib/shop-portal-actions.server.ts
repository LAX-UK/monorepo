"use server";

import { randomUUID } from "node:crypto";
import { commerceErrorMessage } from "@/lib/commerce-error-message";
import { fetchShopCommerceCsrfForMutation } from "@/lib/shop-commerce-mutation.server";
import { shopCommerceRequest } from "@/lib/shop-commerce-request.server";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { revalidatePath } from "next/cache";

export type SaleAuthorityRequestFormState = {
  ok: boolean;
  message: string;
};

function readUpstreamFailure(body: unknown): {
  error?: string;
  code?: string;
  message?: string;
} {
  if (!body || typeof body !== "object") return {};
  const record = body as { code?: string; message?: string; error?: string };
  const out: { error?: string; code?: string; message?: string } = {};
  if (typeof record.error === "string") out.error = record.error;
  if (typeof record.code === "string") out.code = record.code;
  if (typeof record.message === "string") out.message = record.message;
  return out;
}

export async function submitSaleAuthorityRequest(
  _prev: SaleAuthorityRequestFormState,
  formData: FormData,
): Promise<SaleAuthorityRequestFormState> {
  const artworkId = String(formData.get("artworkId") ?? "").trim();
  const requestedCountRaw = formData.get("requestedCount");
  const requestedCount =
    typeof requestedCountRaw === "string" ? Number(requestedCountRaw) : Number(requestedCountRaw);
  const note = String(formData.get("note") ?? "").trim();
  if (!artworkId || Number.isNaN(requestedCount)) {
    return { ok: false, message: "Choose an artwork and a requested count." };
  }
  if (!Number.isInteger(requestedCount) || requestedCount < 0 || requestedCount > 10) {
    return { ok: false, message: "Requested count must be a whole number from 0 to 10." };
  }

  const csrf = await fetchShopCommerceCsrfForMutation();
  if (!csrf.ok) {
    return {
      ok: false,
      message: commerceErrorMessage({ error: "csrf_failed" }, "Could not submit your request."),
    };
  }

  const idempotencyKeyRaw = String(formData.get("idempotencyKey") ?? "").trim();
  const idempotencyKey = idempotencyKeyRaw || randomUUID();
  const response = await shopCommerceRequest(
    "/commerce/me/sale-authority-requests",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-shop-csrf": csrf.token,
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({
        artworkId,
        requestedCount,
        ...(note ? { note } : {}),
      }),
    },
    { applyCookies: true },
  );
  if (response.status === 401) {
    return { ok: false, message: "Sign in again to submit a request." };
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const upstream = readUpstreamFailure(body);
    if (upstream.error === "csrf_failed") {
      return {
        ok: false,
        message: commerceErrorMessage({ error: "csrf_failed" }, "Could not submit your request."),
      };
    }
    if (response.status === 403 || upstream.code === SHOP_API_ERROR_CODES.FORBIDDEN) {
      return {
        ok: false,
        message: "You can only request limits for artworks where you own editions.",
      };
    }
    if (response.status === 409 || upstream.code === SHOP_API_ERROR_CODES.CONFLICT) {
      return {
        ok: false,
        message: "You already have a pending request for this artwork.",
      };
    }
    if (response.status === 400 || upstream.code === SHOP_API_ERROR_CODES.VALIDATION) {
      return {
        ok: false,
        message:
          typeof upstream.message === "string" && upstream.message.trim().length > 0
            ? upstream.message
            : "Check the requested count (0–10) and try again.",
      };
    }
    return {
      ok: false,
      message: commerceErrorMessage(body, "We could not submit your request. Try again later."),
    };
  }
  revalidatePath("/account/sale-limits");
  return { ok: true, message: "Request submitted. Staff will review it shortly." };
}
