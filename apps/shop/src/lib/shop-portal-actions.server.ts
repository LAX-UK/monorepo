"use server";

import { shopCommerceRequest } from "@/lib/shop-commerce-request.server";
import { revalidatePath } from "next/cache";

export type SaleAuthorityRequestFormState = {
  ok: boolean;
  message: string;
};

export async function submitSaleAuthorityRequest(
  _prev: SaleAuthorityRequestFormState,
  formData: FormData,
): Promise<SaleAuthorityRequestFormState> {
  const artworkId = String(formData.get("artworkId") ?? "").trim();
  const requestedCount = Number(formData.get("requestedCount"));
  const note = String(formData.get("note") ?? "").trim();
  if (!artworkId || Number.isNaN(requestedCount)) {
    return { ok: false, message: "Choose an artwork and a requested count." };
  }
  const response = await shopCommerceRequest(
    "/commerce/me/sale-authority-requests",
    {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
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
  if (!response.ok) {
    return { ok: false, message: "We could not submit your request. Try again later." };
  }
  revalidatePath("/account/sale-limits");
  return { ok: true, message: "Request submitted. Staff will review it shortly." };
}
