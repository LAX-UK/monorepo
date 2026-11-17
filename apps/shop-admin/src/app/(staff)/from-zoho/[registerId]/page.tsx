import { AdminFailedPage } from "@/components/admin-fetch-state";
import {
  ConsignorSectionLoader,
  ConsignorSectionSkeleton,
} from "@/components/artwork-consignor/consignor-section";
import { FromZohoRecord } from "@/components/from-zoho/from-zoho-record.client";
import {
  LocationPanelSection,
  LocationPanelSkeleton,
} from "@/components/stock-location/location-panel-section";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import { loadBidAdminUrl } from "@/server/application/load-bid-admin-url";
import { loadZohoFailedJobsHref } from "@/server/application/load-zoho-failed-jobs-href";
import { getShopAdminContainer } from "@/server/container";
import { presentZohoMirror } from "@/server/domain/zoho-mirror.vm";
import { zohoProductUrl } from "@/server/domain/zoho-register.vm";
import type { AdminRegisterDetail, AdminZohoMirrorStatus } from "@auction/shop-contracts";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

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
      locationPanel={
        <Suspense fallback={<LocationPanelSkeleton />}>
          <LocationPanelSection registerId={result.data.registerId} title={result.data.title} />
        </Suspense>
      }
      consignorPanel={
        // Who consigned a work is recorded for originals; a print is LAX's own edition.
        result.data.kind === "original" ? (
          <Suspense fallback={<ConsignorSectionSkeleton />}>
            <ConsignorSectionLoader registerId={result.data.registerId} title={result.data.title} />
          </Suspense>
        ) : null
      }
    />
  );
}
