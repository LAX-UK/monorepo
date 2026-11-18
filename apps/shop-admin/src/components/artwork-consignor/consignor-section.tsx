import { fetchAdminJson } from "@/server/application/load-admin-data";
import type { AdminArtworkConsignor } from "@auction/shop-contracts";
import { SectionSkeleton } from "@auction/staff-ui";
import { ConsignorSection, type ConsignorSectionState } from "./consignor-section.client";

/**
 * The Consignor section's data, read on the server beside the record and streamed in on its own,
 * so a slow or failed read shows in the section without holding up or failing the record. The
 * page renders it only for people who can read consignor agreements; a 403 still (a broker on a
 * work consigned by a client not assigned to them) leaves the section out, as the client's page
 * would be refused.
 */
export async function ConsignorSectionLoader({
  registerId,
  title,
}: {
  registerId: string;
  title: string;
}) {
  const result = await fetchAdminJson<AdminArtworkConsignor>(
    `artwork-register/${encodeURIComponent(registerId)}/consignor`,
  );
  if (result.status === "forbidden") return null;
  const state: ConsignorSectionState =
    result.status === "ok" ? { kind: "loaded", consignor: result.data } : { kind: "failed" };
  return <ConsignorSection registerId={registerId} title={title} state={state} />;
}

/** The section's frame while it loads: a title, the Set consignor button and a few lines. */
export function ConsignorSectionSkeleton() {
  return <SectionSkeleton rows={[1, 2, 2]} description action />;
}
