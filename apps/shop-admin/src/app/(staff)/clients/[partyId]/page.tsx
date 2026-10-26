import { AdminFailedPage } from "@/components/admin-fetch-state";
import { ClientRecordPage } from "@/components/clients/client-record-page.client";
import { fetchAdminJson, loadAdminSession } from "@/server/application/load-admin-data";
import { getShopAdminContainer } from "@/server/container";
import type { AdminClientDetail } from "@auction/shop-contracts";
import { notFound, redirect } from "next/navigation";

export const metadata = { title: "Client" };

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ partyId: string }>;
}) {
  const { partyId } = await params;
  const [result, session] = await Promise.all([
    fetchAdminJson<AdminClientDetail>(`clients/${encodeURIComponent(partyId)}`),
    loadAdminSession(),
  ]);
  if (result.status === "unauthorized" || session.status === "unauthorized") redirect("/login");
  if (result.status === "not_found") notFound();
  if (result.status !== "ok") {
    return <AdminFailedPage title="Client" status={result.status} />;
  }
  const capabilities = session.status === "ok" ? session.data.capabilities : [];

  return (
    <ClientRecordPage
      detail={result.data}
      canGrant={capabilities.includes("sale_authority.write")}
      bidPublicUrl={getShopAdminContainer().config.bidPublicUrl || undefined}
    />
  );
}
