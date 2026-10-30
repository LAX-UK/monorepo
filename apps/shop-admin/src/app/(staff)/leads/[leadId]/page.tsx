import { AdminFailedPage } from "@/components/admin-fetch-state";
import { LeadDetailView } from "@/components/leads/lead-detail-view";
import { fetchAdminJson, loadAdminSession } from "@/server/application/load-admin-data";
import { getShopAdminContainer } from "@/server/container";
import { crmRecordUrl, leadName } from "@/server/domain/lead-list.vm";
import type { AdminGuestErasureState, AdminLeadDetail } from "@auction/shop-contracts";
import { notFound, redirect } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  const result = await fetchAdminJson<AdminLeadDetail>(`leads/${leadId}`);
  return { title: result.status === "ok" ? leadName(result.data) : "Lead" };
}

export default async function LeadPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  const [result, session] = await Promise.all([
    fetchAdminJson<AdminLeadDetail>(`leads/${leadId}`),
    loadAdminSession(),
  ]);
  if (result.status === "unauthorized" || session.status === "unauthorized") redirect("/login");
  if (result.status === "not_found") notFound();
  if (result.status !== "ok") return <AdminFailedPage title="Lead" status={result.status} />;
  const capabilities = session.status === "ok" ? session.data.capabilities : [];
  // Erasure is offered only to people who may erase; a failed read leaves the action out.
  const erasure = capabilities.includes("lead.erase")
    ? await fetchAdminJson<AdminGuestErasureState>(`guests/${leadId}/erasure`)
    : null;
  return (
    <LeadDetailView
      lead={result.data}
      crmUrl={crmRecordUrl(
        getShopAdminContainer().config.crmRecordUrlTemplate,
        result.data.crmRecord,
      )}
      erasure={erasure?.status === "ok" ? erasure.data : null}
    />
  );
}
