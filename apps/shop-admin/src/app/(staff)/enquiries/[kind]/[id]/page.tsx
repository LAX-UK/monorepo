import { AdminFailedPage } from "@/components/admin-fetch-state";
import { EnquiryConversation } from "@/components/enquiries/enquiry-conversation.client";
import { fetchAdminJson, loadAdminSession } from "@/server/application/load-admin-data";
import { getShopAdminContainer } from "@/server/container";
import { enquiryContextLinks } from "@/server/domain/enquiry-detail.vm";
import {
  type AdminEnquiryAssigneesResponse,
  type AdminEnquiryDetail,
  ENQUIRY_KINDS,
} from "@auction/shop-contracts";
import { notFound, redirect } from "next/navigation";

export const metadata = { title: "Enquiry" };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EnquiryDetailPage({
  params,
}: {
  params: Promise<{ kind: string; id: string }>;
}) {
  const { kind, id } = await params;
  if (!ENQUIRY_KINDS.some((known) => known === kind) || !UUID_PATTERN.test(id)) notFound();

  const [detailResult, sessionResult] = await Promise.all([
    fetchAdminJson<AdminEnquiryDetail>(`enquiries/${kind}/${id}`),
    loadAdminSession(),
  ]);
  if (detailResult.status === "unauthorized" || sessionResult.status === "unauthorized") {
    redirect("/login");
  }
  if (detailResult.status === "not_found") notFound();
  if (detailResult.status !== "ok" || sessionResult.status !== "ok") {
    return <AdminFailedPage title="Enquiry" status="failed" />;
  }

  const session = sessionResult.data;
  const canWrite = session.capabilities.includes("enquiry.write");
  const assignees = canWrite
    ? await fetchAdminJson<AdminEnquiryAssigneesResponse>("enquiries/assignees")
    : null;
  if (canWrite && assignees?.status !== "ok") {
    return <AdminFailedPage title="Enquiry" status="failed" />;
  }

  return (
    <EnquiryConversation
      detail={detailResult.data}
      assignees={assignees?.status === "ok" ? assignees.data.items : []}
      currentSubject={session.subject}
      canWrite={canWrite}
      contextLinks={enquiryContextLinks(
        detailResult.data,
        getShopAdminContainer().config.artPublicUrl ?? null,
      )}
    />
  );
}
