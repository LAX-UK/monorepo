"use client";

import type { AdminConsignorAgreementList } from "@auction/shop-contracts";
import {
  DetailPage,
  StaffBreadcrumbs,
  type StaffLinkComponent,
  StatusBadge,
} from "@auction/staff-ui";
import Link from "next/link";
import { AgreementsSection } from "./agreements-section.client";

const NextLink: StaffLinkComponent = Link;

/**
 * A client's page for someone who keeps consignor agreements but cannot read clients (a Catalogue
 * editor): the consignor's name and their Agreements, and nothing else of the client record.
 */
export function ConsignorAgreementsPage({ list }: { list: AdminConsignorAgreementList }) {
  return (
    <DetailPage
      breadcrumbs={<StaffBreadcrumbs Link={NextLink} items={[{ label: list.party.displayName }]} />}
      title={list.party.displayName}
      status={<StatusBadge tone="neutral">Consignor</StatusBadge>}
    >
      <AgreementsSection
        partyId={list.party.partyId}
        consignorName={list.party.displayName}
        agreements={list.items}
      />
    </DetailPage>
  );
}
