import { AccountUnavailable } from "@/components/account-unavailable";
import { loadSellingEntry } from "@/server/application/load-selling";
import { ACCOUNT_ROUTES } from "@/server/domain/account-settings.vm";
import { firstSellingTool } from "@/server/domain/selling/selling-access";
import { SELLING_ROUTES } from "@/server/domain/selling/selling-routes";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** The Selling menu entry opens the first seller tool the person holds. */
export default async function SellingEntryPage() {
  const entry = await loadSellingEntry();
  if (entry.status === "unavailable")
    return <AccountUnavailable retryHref={SELLING_ROUTES.overview} />;
  if (entry.status === "unsigned") {
    redirect(`/api/auth/login?returnTo=${encodeURIComponent(SELLING_ROUTES.overview)}`);
  }
  const tool = firstSellingTool(entry.access);
  redirect(tool ? SELLING_ROUTES[tool] : ACCOUNT_ROUTES.overview);
}
