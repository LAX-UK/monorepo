import { AdminFailedPage } from "@/components/admin-fetch-state";
import { FromZohoRecord } from "@/components/from-zoho/from-zoho-record.client";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import { loadBidAdminUrl } from "@/server/application/load-bid-admin-url";
import { loadZohoFailedJobsHref } from "@/server/application/load-zoho-failed-jobs-href";
import { getShopAdminContainer } from "@/server/container";
import { presentZohoMirror } from "@/server/domain/zoho-mirror.vm";
import { zohoProductUrl } from "@/server/domain/zoho-register.vm";
import type { AdminRegisterDetail, AdminZohoMirrorStatus } from "@auction/shop-contracts";
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
  // The Zoho badge is read beside the record, not after it; a failed read leaves the badge out.
  const [result, mirror] = await Promise.all([
    fetchAdminJson<AdminRegisterDetail>(`artwork-register/${registerId}`),
    fetchAdminJson<AdminZohoMirrorStatus>(
      `zoho-mirror/status?entity=artwork&id=${encodeURIComponent(registerId)}`,
    ),
  ]);
  if (result.status === "unauthorized") redirect("/login");
  if (result.status === "not_found") notFound();
  if (result.status !== "ok") {
    return <AdminFailedPage title="Artwork from Zoho" status={result.status} />;
  }
  const mirrorStatus = mirror.status === "ok" ? mirror.data : null;
  // Failed jobs is in Bid admin: linked only for people Bid shows the Zoho rows to (Q7, PRM-1),
  // and Bid is asked only on failure.
  const zohoMirror = presentZohoMirror(mirrorStatus, {
    failedJobsHref: mirrorStatus?.state === "failed" ? await loadZohoFailedJobsHref() : null,
  });
  return (
    <FromZohoRecord
      detail={result.data}
      zohoMirror={zohoMirror}
      bidAdminUrl={await loadBidAdminUrl()}
      zohoUrl={zohoProductUrl(
        getShopAdminContainer().config.crmRecordUrlTemplate,
        result.data.zohoProductId,
        result.data.zohoModule,
      )}
    />
  );
}
