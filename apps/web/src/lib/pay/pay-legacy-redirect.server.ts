import "server-only";

import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { redirect } from "next/navigation";
import { loadPayPlan } from "./pay-api.server";
import { payLandingRedirect } from "./pay-landing";
import { payHref } from "./pay-links";
import { parsePayLots } from "./pay-lots";

/**
 * Sends an old checkout address (an emailed link, a bookmark, a payment return opened before the
 * Pay page existed) to where it belongs in one step: the purchase of a lot that is already paid,
 * the Pay page for anything else. Those addresses keep working for good.
 */
export async function redirectLegacyCheckout(
  rawLots: string | string[] | undefined,
  legacyPath: string,
): Promise<never> {
  const lots = parsePayLots(rawLots);
  const target = payHref(lots.kind === "lots" ? lots.ids : []);
  await requireAuthenticatedUser({ shell: "client", loginNext: legacyPath });
  if (lots.kind === "lots") {
    const read = await loadPayPlan(lots.ids);
    const paid = read.kind === "ok" ? payLandingRedirect(lots.ids, read.plan) : null;
    if (paid) redirect(paid);
  }
  redirect(target);
}
