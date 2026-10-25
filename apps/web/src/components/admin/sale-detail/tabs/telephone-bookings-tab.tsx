"use client";

import { RelatedRecordsSection } from "@/components/admin/people/related-records-section";
import { useTelephoneBookingActions } from "@/components/admin/sale-detail/tabs/use-telephone-booking-actions";
import { downloadSaleTelephoneBookingsCsv } from "@/lib/admin/export-sale-telephone-bookings-csv";
import { staffTelephoneBookingStatus } from "@/lib/admin/staff-kit-status";
import type { AdminTelephoneBookingRow } from "@/lib/data/http/admin.server";
import { decimalToMinorUnits } from "@/lib/data/view-models/client-commerce-tab.vm";
import {
  SALE_TELEPHONE_FILTERS,
  type SaleTelephoneFilter,
  filterSaleTelephoneBookings,
  matchesSaleTelephoneSearch,
  telephoneBidderLabel,
} from "@/lib/data/view-models/sale-telephone-tab.vm";
import {
  CellLink,
  type DataColumn,
  DataTableToolbar,
  EmptyState,
  ErrorState,
  Notice,
  PersonCell,
  Section,
  SegmentedControl,
  StaffButton,
  StaffDate,
  type StaffLinkComponent,
  StaffMoney,
  StatusBadge,
  TableSearch,
  rowActionsColumn,
} from "@auction/staff-ui";
import type { Sale } from "@auction/types";
import Link from "next/link";
import { useMemo, useState } from "react";

const NextLink: StaffLinkComponent = Link;

type Props = {
  saleId: string;
  sale: Sale;
  liveish: boolean;
  rows: AdminTelephoneBookingRow[];
  fetchError: string | null;
  actionError: string | null;
};

/** Telephone lines bidders have asked for in this sale, and what the clerks do with each. */
export function SaleTelephoneBookingsTab({
  saleId,
  sale,
  liveish,
  rows,
  fetchError,
  actionError,
}: Props) {
  const [filter, setFilter] = useState<SaleTelephoneFilter>("all");
  const [search, setSearch] = useState("");
  const { actionsFor, dialogs } = useTelephoneBookingActions(saleId);

  const filtered = useMemo(
    () =>
      filterSaleTelephoneBookings(rows, filter).filter((row) =>
        matchesSaleTelephoneSearch(row, search),
      ),
    [rows, filter, search],
  );

  const columns = useMemo<DataColumn<AdminTelephoneBookingRow>[]>(
    () => [
      {
        id: "bidder",
        header: "Bidder",
        mobile: "title",
        sortable: true,
        sortValue: (row) => telephoneBidderLabel(row).toLowerCase(),
        cell: (row) => (
          <PersonCell
            name={telephoneBidderLabel(row)}
            secondary={row.userName && row.userEmail ? row.userEmail : null}
            href={`/admin/clients/${encodeURIComponent(row.userId)}`}
            Link={NextLink}
          />
        ),
      },
      {
        id: "phone",
        header: "Phone",
        width: "176px",
        mobile: "meta",
        truncate: false,
        cell: (row) => (
          <CellLink href={`tel:${row.phoneE164}`}>{row.phoneDisplay ?? row.phoneE164}</CellLink>
        ),
      },
      {
        id: "status",
        header: "Status",
        width: "240px",
        mobile: "badge",
        truncate: false,
        cell: (row) => {
          const status = staffTelephoneBookingStatus(row.status);
          return (
            <span className="flex flex-wrap items-center gap-1.5">
              <StatusBadge tone={status.tone} live={status.live ?? false}>
                {status.label}
              </StatusBadge>
              {row.limitIncreaseRequestedAt != null && row.status !== "cancelled" ? (
                <StatusBadge tone="warning">Higher limit asked</StatusBadge>
              ) : null}
            </span>
          );
        },
      },
      {
        id: "authorised",
        header: "Authorised max",
        numeric: true,
        width: "144px",
        mobile: "meta",
        sortable: true,
        sortValue: (row) => decimalToMinorUnits(row.authorizedMax),
        cell: (row) => <StaffMoney minor={decimalToMinorUnits(row.authorizedMax)} />,
      },
      {
        id: "requested",
        header: "Requested",
        width: "128px",
        hideBelow: "md",
        mobile: "hidden",
        sortable: true,
        defaultSortDirection: "desc",
        sortValue: (row) => row.createdAt.getTime(),
        cell: (row) => <StaffDate value={row.createdAt} />,
      },
      rowActionsColumn<AdminTelephoneBookingRow>({
        actions: actionsFor,
        label: (row) => `Actions for ${telephoneBidderLabel(row)}`,
        Link: NextLink,
      }),
    ],
    [actionsFor],
  );

  if (!liveish) {
    return (
      <Section title="Telephone bookings">
        <EmptyState
          headingLevel="h3"
          title="Telephone bookings open with the sale"
          description="Bidders can ask for a telephone line once the sale is scheduled. Their requests appear here."
        />
      </Section>
    );
  }

  const filtering = search.trim() !== "" || filter !== "all";

  return (
    <div className="flex flex-col gap-6">
      {actionError ? (
        <Notice tone="danger" alert title="That did not go through">
          {actionError}
        </Notice>
      ) : null}

      {fetchError ? (
        <Section title="Telephone bookings">
          <ErrorState
            headingLevel="h3"
            title="Telephone bookings could not be loaded"
            description={fetchError}
          />
        </Section>
      ) : (
        <RelatedRecordsSection
          id="telephone-bookings"
          density="comfortable"
          title="Telephone bookings"
          description="Confirm lines, assign clerks and follow telephone bidding."
          action={
            <StaffButton
              size="sm"
              variant="secondary"
              {...(rows.length === 0 ? { disabledReason: "There are no bookings to export" } : {})}
              onClick={() => downloadSaleTelephoneBookingsCsv(rows, sale.title)}
            >
              Export CSV
            </StaffButton>
          }
          label="Telephone bookings"
          columns={columns}
          data={filtered}
          getRowId={(row) => row.id}
          defaultSort={{ columnId: "requested", direction: "desc" }}
          toolbar={
            <DataTableToolbar
              search={
                <TableSearch
                  live
                  label="Search telephone bookings"
                  placeholder="Name, email or phone"
                  value={search}
                  onSearch={setSearch}
                />
              }
              filters={
                <SegmentedControl<SaleTelephoneFilter>
                  label="Booking status"
                  value={filter}
                  onValueChange={setFilter}
                  options={SALE_TELEPHONE_FILTERS}
                />
              }
            />
          }
          empty={
            filtering
              ? { title: "No bookings match", description: "Try a different search or status." }
              : {
                  title: "No telephone bookings yet",
                  description:
                    "Bidders who ask for a telephone line on this sale appear here to be confirmed.",
                }
          }
        />
      )}
      {dialogs}
    </div>
  );
}
