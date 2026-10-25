"use client";

import { ExpectedGuestsPanel } from "@/components/admin/expected-guests-panel";
import { RelatedRecordsSection } from "@/components/admin/people/related-records-section";
import { useSaleRegistrationActions } from "@/components/admin/sale-detail/tabs/use-sale-registration-actions";
import { SaleroomCheckInPanel } from "@/components/admin/saleroom-check-in-panel";
import { downloadSaleRegistrationsCsv } from "@/lib/admin/export-sale-registrations-csv";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import type { AdminExpectedGuestsSummary } from "@/lib/data/http/admin-expected-guests.server";
import type { AdminSaleRegistrationRow } from "@/lib/data/http/admin-sale-registrations.types";
import { decimalToMinorUnits } from "@/lib/data/view-models/client-commerce-tab.vm";
import {
  type SaleRegistrationsFilter,
  filterSaleRegistrations,
  matchesSaleRegistrationSearch,
  registrationBidderLabel,
  registrationCheckInStatus,
  saleRegistrationsFilters,
} from "@/lib/data/view-models/sale-registrations-tab.vm";
import {
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
import { isSaleroomDeliveryMode } from "@auction/validators";
import Link from "next/link";
import { useMemo, useState } from "react";

const NextLink: StaffLinkComponent = Link;

type Props = {
  saleId: string;
  sale: Sale;
  liveish: boolean;
  rows: AdminSaleRegistrationRow[];
  fetchError: string | null;
  actionError: string | null;
  saleCurrency?: string;
  expectedGuests?: AdminExpectedGuestsSummary | null;
};

/** Who has asked to bid in this sale, with approval, paddles and in-room check-in. */
export function SaleRegistrationsTab({
  saleId,
  sale,
  liveish,
  rows,
  fetchError,
  actionError,
  saleCurrency = "GBP",
  expectedGuests = null,
}: Props) {
  const saleroom = isSaleroomDeliveryMode(sale.deliveryMode);
  const [filter, setFilter] = useState<SaleRegistrationsFilter>("all");
  const [search, setSearch] = useState("");
  const { actionsFor, dialogs } = useSaleRegistrationActions({
    saleId,
    saleroom,
    hybrid: sale.deliveryMode === "hybrid",
  });

  const filtered = useMemo(
    () =>
      filterSaleRegistrations(rows, filter).filter((row) =>
        matchesSaleRegistrationSearch(row, search),
      ),
    [rows, filter, search],
  );

  const columns = useMemo<DataColumn<AdminSaleRegistrationRow>[]>(
    () => [
      {
        id: "bidder",
        header: "Bidder",
        mobile: "title",
        sortable: true,
        sortValue: (row) => registrationBidderLabel(row).toLowerCase(),
        cell: (row) => (
          <PersonCell
            name={registrationBidderLabel(row)}
            secondary={row.userName && row.userEmail ? row.userEmail : null}
            href={`/admin/clients/${encodeURIComponent(row.userId)}`}
            Link={NextLink}
          />
        ),
      },
      {
        id: "entity",
        header: "Buying as",
        width: "200px",
        hideBelow: "lg",
        mobile: "hidden",
        cell: (row) => row.buyerLegalEntityDisplayName,
      },
      {
        id: "status",
        header: "Status",
        width: "128px",
        mobile: "badge",
        truncate: false,
        cell: (row) => {
          const status = staffStatus("registration", row.status);
          return <StatusBadge tone={status.tone}>{status.label}</StatusBadge>;
        },
      },
      ...(saleroom
        ? [
            {
              id: "check-in",
              header: "At the door",
              width: "160px",
              hideBelow: "md",
              mobile: "meta",
              truncate: false,
              cell: (row: AdminSaleRegistrationRow) => {
                const status = registrationCheckInStatus(row);
                return status ? <StatusBadge tone={status.tone}>{status.label}</StatusBadge> : null;
              },
            } satisfies DataColumn<AdminSaleRegistrationRow>,
          ]
        : []),
      {
        id: "paddle",
        header: "Paddle",
        numeric: true,
        width: "96px",
        sortable: true,
        sortValue: (row) => row.paddleNumber,
        mobile: "meta",
        cell: (row) => row.paddleNumber,
      },
      {
        id: "limit",
        header: "Bid limit",
        numeric: true,
        width: "128px",
        hideBelow: "xl",
        mobile: "hidden",
        sortable: true,
        sortValue: (row) => decimalToMinorUnits(row.bidLimit),
        cell: (row) => (
          <StaffMoney minor={decimalToMinorUnits(row.bidLimit)} currency={saleCurrency} />
        ),
      },
      {
        id: "requested",
        header: "Requested",
        width: "128px",
        sortable: true,
        defaultSortDirection: "desc",
        sortValue: (row) => new Date(row.requestedAt).getTime(),
        mobile: "hidden",
        cell: (row) => <StaffDate value={row.requestedAt} />,
      },
      rowActionsColumn<AdminSaleRegistrationRow>({
        actions: actionsFor,
        label: (row) => `Actions for ${registrationBidderLabel(row)}`,
        Link: NextLink,
      }),
    ],
    [actionsFor, saleCurrency, saleroom],
  );

  if (!liveish) {
    return (
      <Section title="Registrations">
        <EmptyState
          headingLevel="h3"
          title="Registrations open with the sale"
          description="Bidders can ask to register once the sale is scheduled. Their requests appear here for approval."
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
        <Section title="Registrations">
          <ErrorState
            headingLevel="h3"
            title="Registrations could not be loaded"
            description={fetchError}
          />
        </Section>
      ) : (
        <RelatedRecordsSection
          id="registrations"
          density="comfortable"
          title="Registrations"
          description={
            saleroom
              ? "Approve requests and give in-room bidders their paddle at check-in."
              : "Approve or reject requests to bid before and during the sale."
          }
          action={
            <StaffButton
              size="sm"
              variant="secondary"
              {...(rows.length === 0
                ? { disabledReason: "There are no registrations to export" }
                : {})}
              onClick={() => downloadSaleRegistrationsCsv(rows, sale.title)}
            >
              Export CSV
            </StaffButton>
          }
          label="Sale registrations"
          columns={columns}
          data={filtered}
          getRowId={(row) => row.id}
          defaultSort={{ columnId: "requested", direction: "desc" }}
          toolbar={
            <DataTableToolbar
              search={
                <TableSearch
                  live
                  label="Search registrations"
                  placeholder="Name, email or paddle"
                  value={search}
                  onSearch={setSearch}
                />
              }
              filters={
                <SegmentedControl<SaleRegistrationsFilter>
                  label="Registration status"
                  value={filter}
                  onValueChange={setFilter}
                  options={saleRegistrationsFilters(saleroom)}
                />
              }
            />
          }
          empty={
            filtering
              ? {
                  title: "No registrations match",
                  description: "Try a different search or status.",
                }
              : {
                  title: "No registrations yet",
                  description: saleroom
                    ? "Requests to bid appear here for approval. Use in-room check-in below for walk-ins."
                    : "Buyers who ask to bid on this sale appear here for approval.",
                }
          }
        />
      )}

      {expectedGuests?.eventSlug && expectedGuests.items.length > 0 ? (
        <ExpectedGuestsPanel
          saleId={saleId}
          deliveryMode={sale.deliveryMode}
          eventSlug={expectedGuests.eventSlug}
          eventTitle={expectedGuests.eventTitle ?? expectedGuests.eventSlug}
          segmentOptions={expectedGuests.segmentOptions}
          items={expectedGuests.items}
        />
      ) : null}

      {saleroom ? (
        <SaleroomCheckInPanel
          saleId={saleId}
          saleCurrency={saleCurrency}
          deliveryMode={sale.deliveryMode}
        />
      ) : null}

      {dialogs}
    </div>
  );
}
