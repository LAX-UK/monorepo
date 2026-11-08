import { AdminFailedPage } from "@/components/admin-fetch-state";
import { FromZohoRecord } from "@/components/from-zoho/from-zoho-record.client";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import { loadBidAdminUrl } from "@/server/application/load-bid-admin-url";
import { getShopAdminContainer } from "@/server/container";
import { zohoProductUrl } from "@/server/domain/zoho-register.vm";
import type { AdminRegisterDetail } from "@auction/shop-contracts";
import { notFound, redirect } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ registerId: string }> }) {
  const { registerId } = await params;
  const result = await fetchAdminJson<AdminRegisterDetail>(`artwork-register/${registerId}`);
  return { title: result.status === "ok" ? result.data.title : "Artwork from Zoho" };
}

export default async function FromZohoRecordPage({
  params,
}: {
  params: Promise<{ registerId: string }>;
}) {
  const { registerId } = await params;
  const result = await fetchAdminJson<AdminRegisterDetail>(`artwork-register/${registerId}`);
  if (result.status === "unauthorized") redirect("/login");
  if (result.status === "not_found") notFound();
  if (result.status !== "ok") {
    return <AdminFailedPage title="Artwork from Zoho" status={result.status} />;
  }
  return (
    <FromZohoRecord
      detail={result.data}
      bidAdminUrl={await loadBidAdminUrl()}
      zohoUrl={zohoProductUrl(
        getShopAdminContainer().config.crmRecordUrlTemplate,
        result.data.zohoProductId,
        result.data.kind,
      )}
    />
  );
}
