import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { getBuyerSourceOfFundsView } from "@/lib/data/http/compliance.server";
import { redirect } from "next/navigation";
import { SofComplianceClient } from "./sof-compliance-client";

export default async function SourceOfFundsCompliancePage() {
  const view = await getBuyerSourceOfFundsView();
  if (!view) {
    redirect("/dashboard/portfolio");
  }

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Source of funds verification"
        description="Securely upload documents requested by our compliance team. Do not send sensitive files by email."
      />
      <SofComplianceClient initial={view} />
    </DashboardPage>
  );
}
