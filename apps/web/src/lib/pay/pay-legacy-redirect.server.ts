import "server-only";

import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { redirect } from "next/navigation";
import { loadPayPlan } from "./pay-api.server";
import { legacyCheckoutTarget } from "./pay-legacy";
import { payHref } from "./pay-links";
import { parsePayLots } from "./pay-lots";

/**
 * Sends an old checkout address (an emailed link, a bookmark, a payment return opened before the
 * Pay page existed) to where it belongs in one step. Those addresses keep working for good. The
 * payment page's own return (`?payment=success|cancelled`) is read here, so a return never shows
 * a fresh Pay button while a payment may be pending.
 */
export async function redirectLegacyCheckout(
  rawLots: string | string[] | undefined,
  payment: string | string[] | undefined,
): Promise<never> {
  const lots = parsePayLots(rawLots);
  const ids = lots.kind === "lots" ? lots.ids : [];
  await requireAuthenticatedUser({ shell: "client", loginNext: payHref(ids) });
  const read = ids.length > 0 ? await loadPayPlan(ids) : null;
  redirect(legacyCheckoutTarget(ids, payment, read?.kind === "ok" ? read.plan : null));
}
