import { AdminFailedPage } from "@/components/admin-fetch-state";
import { ClientRecordPage } from "@/components/clients/client-record-page.client";
import {
  AgreementsSectionLoader,
  AgreementsSectionSkeleton,
} from "@/components/consignor-agreements/agreements-section";
import { ConsignorAgreementsPage } from "@/components/consignor-agreements/consignor-agreements-page.client";
import { fetchAdminJson, loadAdminSession } from "@/server/application/load-admin-data";
import { getShopAdminContainer } from "@/server/container";
import type { AdminClientDetail, AdminConsignorAgreementList } from "@auction/shop-contracts";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

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
  const capabilities = session.status === "ok" ? session.data.capabilities : [];

  // Someone who keeps consignor agreements without reading clients sees the agreements alone.
  if (result.status === "forbidden" && capabilities.includes("consignor_agreement.manage")) {
    const list = await fetchAdminJson<AdminConsignorAgreementList>(
      `clients/${encodeURIComponent(partyId)}/consignor-agreements`,
    );
    if (list.status === "unauthorized") redirect("/login");
    if (list.status === "not_found") notFound();
    if (list.status !== "ok") return <AdminFailedPage title="Client" status={list.status} />;
    return <ConsignorAgreementsPage list={list.data} />;
  }
  if (result.status !== "ok") {
    return <AdminFailedPage title="Client" status={result.status} />;
  }

  return (
    <ClientRecordPage
      detail={result.data}
      canGrant={capabilities.includes("sale_authority.write")}
      bidPublicUrl={getShopAdminContainer().config.bidPublicUrl || undefined}
      agreements={
        capabilities.includes("consignor_agreement.read") ? (
          <Suspense fallback={<AgreementsSectionSkeleton />}>
            <AgreementsSectionLoader
              partyId={result.data.party.partyId}
              consignorName={result.data.party.displayName}
            />
          </Suspense>
        ) : null
      }
    />
  );
}
