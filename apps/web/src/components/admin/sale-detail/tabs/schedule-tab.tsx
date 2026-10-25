"use client";

import { RelatedRecordsSection } from "@/components/admin/people/related-records-section";
import { saleDetailTabHref } from "@/components/admin/sale-detail/sale-detail-types";
import {
  closingPattern,
  closingPatternText,
  lotsInClosingOrder,
} from "@/lib/data/view-models/sale-schedule-tab.vm";
import {
  type DataColumn,
  KeyValueList,
  PrimaryCell,
  Section,
  StaffButton,
  StaffDate,
  type StaffLinkComponent,
} from "@auction/staff-ui";
import type { Lot, Sale } from "@auction/types";
import { isSaleroomDeliveryMode } from "@auction/validators";
import Link from "next/link";
import { useMemo } from "react";

const NextLink: StaffLinkComponent = Link;

type Props = {
  saleId: string;
  sale: Sale;
  lots: Lot[];
};

const lotColumns: DataColumn<Lot>[] = [
  {
    id: "lot",
    header: "Lot",
    mobile: "title",
    sortable: true,
    sortValue: (lot) => lot.lotNumber ?? Number.MAX_SAFE_INTEGER,
    cell: (lot) => (
      <PrimaryCell
        Link={NextLink}
        href={`/admin/lots/${encodeURIComponent(lot.id)}`}
        secondary={lot.lotNumber != null ? `Lot ${lot.lotNumber}` : null}
      >
        {lot.title}
      </PrimaryCell>
    ),
  },
  {
    id: "opens",
    header: "Opens",
    width: "208px",
    hideBelow: "md",
    mobile: "meta",
    sortable: true,
    sortValue: (lot) => new Date(lot.startTime).getTime(),
    cell: (lot) => <StaffDate value={lot.startTime} withTime />,
  },
  {
    id: "closes",
    header: "Closes",
    width: "208px",
    mobile: "meta",
    sortable: true,
    sortValue: (lot) => new Date(lot.endTime).getTime(),
    cell: (lot) => <StaffDate value={lot.endTime} withTime />,
  },
];

/** When bidding opens and closes: the preview, and each lot in the order it closes. */
export function SaleScheduleTab({ saleId, sale, lots }: Props) {
  const ordered = useMemo(() => lotsInClosingOrder(lots), [lots]);
  const pattern = useMemo(() => closingPattern(lots), [lots]);
  const saleroom = isSaleroomDeliveryMode(sale.deliveryMode);

  return (
    <div className="flex flex-col gap-6">
      <Section
        title="Timing"
        action={
          <StaffButton asChild size="sm" variant="secondary">
            <Link href={`/admin/sales/${encodeURIComponent(saleId)}/edit`}>Edit schedule</Link>
          </StaffButton>
        }
      >
        <KeyValueList
          items={[
            {
              label: "Preview opens",
              value: sale.previewStartTime ? (
                <StaffDate value={sale.previewStartTime} withTime />
              ) : (
                "No preview scheduled"
              ),
            },
            { label: "Lot closing", value: closingPatternText(pattern) },
          ]}
        />
      </Section>

      <RelatedRecordsSection
        id="lot-timing"
        density="comfortable"
        title="Lots in closing order"
        description={
          saleroom
            ? "Saleroom lots usually share the sale window and are called live in the room."
            : "Each online lot has its own opening and closing time."
        }
        label="Lot timing"
        columns={lotColumns}
        data={ordered}
        getRowId={(lot) => lot.id}
        defaultSort={{ columnId: "closes", direction: "asc" }}
        empty={{
          title: "No lots attached yet",
          description: "Lots appear here with their closing times once they are added to the sale.",
          action: (
            <StaffButton asChild size="sm" variant="secondary">
              <Link href={saleDetailTabHref(saleId, "lots")}>Add lots</Link>
            </StaffButton>
          ),
        }}
      />
    </div>
  );
}
