import { fetchAdminJson } from "@/server/application/load-admin-data";
import type { AdminConsignorAgreementList } from "@auction/shop-contracts";
import { SectionSkeleton } from "@auction/staff-ui";
import { AgreementsSection } from "./agreements-section.client";

/**
 * The Agreements section's data, read on the server beside the client record and streamed in on
 * its own, so a slow or failed read shows in the section without holding up the page.
 */
export async function AgreementsSectionLoader({
  partyId,
  consignorName,
}: {
  partyId: string;
  consignorName: string;
}) {
  const list = await fetchAdminJson<AdminConsignorAgreementList>(
    `clients/${encodeURIComponent(partyId)}/consignor-agreements`,
  );
  return (
    <AgreementsSection
      partyId={partyId}
      consignorName={consignorName}
      agreements={list.status === "ok" ? list.data.items : null}
    />
  );
}

/** The section's frame while its agreements load: a title, Add agreement and a few lines. */
export function AgreementsSectionSkeleton() {
  return <SectionSkeleton rows={[1, 2, 2]} description action />;
}
