"use server";

import { readApiError } from "@/lib/actions/_utils";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function updateBiddingPreferencesAction(formData: FormData): Promise<void> {
  const outbidInApp = formData.get("outbidInApp") === "on" || formData.get("outbidInApp") === "true";
  const outbidPush = formData.get("outbidPush") === "on" || formData.get("outbidPush") === "true";
  const endingSoonPush =
    formData.get("endingSoonPush") === "on" || formData.get("endingSoonPush") === "true";
  const defaultMaxBidAmountRaw = String(formData.get("defaultMaxBidAmount") ?? "").trim();
  const defaultMaxBidAmount = defaultMaxBidAmountRaw === "" ? null : defaultMaxBidAmountRaw;

  const res = await authedServerFetch("/users/me/bidding-preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      outbidInApp,
      outbidPush,
      endingSoonPush,
      defaultMaxBidAmount,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    redirect(
      `/dashboard/settings/bidding?error=${encodeURIComponent(readApiError(body, "Update failed"))}`,
    );
  }
  revalidatePath("/dashboard/settings/bidding");
  redirect("/dashboard/settings/bidding?saved=1");
}
