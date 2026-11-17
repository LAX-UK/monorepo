import { getShopAdminContainer } from "../container";
import { zohoFailedJobsHref } from "../domain/zoho-mirror.vm";
import { loadStaffToolsAnswer } from "./load-staff-products";

/**
 * Where "Open in Failed jobs" goes from a LAX Admin record that is not in Zoho, or null when the
 * person cannot open it (Q7, PRM-1). Bid decides, on the server: the link needs Bid admin and Bid's
 * own access table to show this person the Zoho rows, so a Bid specialist or finance never lands
 * on a refusal. Any doubt (no session, Bid unavailable) leaves the link out.
 */
export async function loadZohoFailedJobsHref(): Promise<string | null> {
  const answer = await loadStaffToolsAnswer();
  if (answer.status !== "ok" || !answer.tools.includes("bid-admin")) return null;
  return zohoFailedJobsHref({
    bidUrl: getShopAdminContainer().config.bidPublicUrl ?? null,
    failedJobSources: answer.failedJobSources,
  });
}
