"use server";

import { instrumentServerAction } from "@/lib/observability/instrument-server-action";

import { getWriteContainer } from "@/lib/data/write-container.server";
import {
  type ActionResult,
  actionFailure,
  actionSuccess,
  firstZodErrorMessage,
  zodErrorToFieldErrors,
} from "@/lib/forms/form-result";
import { biddingPreferencesPatchSchema } from "@auction/validators";
import { revalidatePath } from "next/cache";

export async function updateBiddingPreferencesFromValuesAction(
  input: unknown,
): Promise<ActionResult<void>> {
  return instrumentServerAction("updateBiddingPreferencesFromValuesAction", async () => {
    const parsed = biddingPreferencesPatchSchema.safeParse(input);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error), zodErrorToFieldErrors(parsed.error));
    }
    const { biddingPrefs } = getWriteContainer();
    const r = await biddingPrefs.patch(parsed.data);
    if (!r.ok) {
      return actionFailure(r.message, undefined, r.status);
    }
    revalidatePath("/dashboard/settings/bidding");
    return actionSuccess();
  });
}

export async function updateBiddingPreferencesAction(formData: FormData): Promise<void> {
  return instrumentServerAction(
    "updateBiddingPreferencesAction",
    async () => {
      const outbidInApp =
        formData.get("outbidInApp") === "on" || formData.get("outbidInApp") === "true";
      const outbidPush =
        formData.get("outbidPush") === "on" || formData.get("outbidPush") === "true";
      const endingSoonPush =
        formData.get("endingSoonPush") === "on" || formData.get("endingSoonPush") === "true";
      const defaultMaxBidAmountRaw = String(formData.get("defaultMaxBidAmount") ?? "").trim();
      const defaultMaxBidAmount = defaultMaxBidAmountRaw === "" ? null : defaultMaxBidAmountRaw;
      const { biddingPrefs } = getWriteContainer();
      const r = await biddingPrefs.patch({
        outbidInApp,
        outbidPush,
        endingSoonPush,
        defaultMaxBidAmount: defaultMaxBidAmount ?? undefined,
      });
      if (!r.ok) {
        const { redirect } = await import("next/navigation");
        redirect(`/dashboard/settings/bidding?error=${encodeURIComponent(r.message)}`);
      }
      revalidatePath("/dashboard/settings/bidding");
      const { redirect } = await import("next/navigation");
      redirect("/dashboard/settings/bidding?saved=1");
    },
    { formData },
  );
}
