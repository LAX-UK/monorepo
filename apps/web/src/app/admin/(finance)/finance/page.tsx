import { FinanceHub } from "@/components/admin/finance/finance-hub";
import { financeAttention, financeTools } from "@/lib/admin/finance/finance-hub.vm";
import { loadAdminFinanceHubPage } from "@/lib/admin/finance/load-finance-hub-page";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Finance",
  "Payments, payouts, disputes and accounting integrations.",
);

export default async function FinanceAdminHomePage() {
  const { financeIssues, navCounts, failedPayouts, loadError } = await loadAdminFinanceHubPage();

  return (
    <FinanceHub
      attention={financeAttention(navCounts, financeIssues, failedPayouts)}
      tools={financeTools(navCounts)}
      loadError={loadError}
    />
  );
}
