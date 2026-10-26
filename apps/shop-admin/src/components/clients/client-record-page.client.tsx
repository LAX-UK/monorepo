"use client";

import { GrantSaleAuthorityDialog } from "@/components/clients/grant-sale-authority-dialog.client";
import {
  bidClientHref,
  clientFigures,
  clientOrdersHref,
  enquiryHref,
  enquirySubject,
} from "@/server/domain/client-record.vm";
import { ownedArtworkOptions, partyKindLabel } from "@/server/domain/lookup-options.vm";
import { orderNumber } from "@/server/domain/order-list.vm";
import { payoutSourceLabel } from "@/server/domain/payout-list.vm";
import { requestedEditionsLabel } from "@/server/domain/sale-authority.vm";
import { presentStatus } from "@/server/domain/staff-status";
import type { AdminClientDetail } from "@auction/shop-contracts";
import {
  type DataColumn,
  DetailPage,
  MappedStatusBadge,
  MetaItem,
  type OverflowAction,
  OverflowMenu,
  PrimaryCell,
  RelatedRecordsSection,
  StaffBreadcrumbs,
  StaffButton,
  StaffDate,
  type StaffLinkComponent,
  StaffMoney,
  StatGrid,
  StatusBadge,
  toast,
} from "@auction/staff-ui";
import { Copy, ExternalLink, Mail, ShieldCheck } from "@auction/staff-ui/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const NextLink: StaffLinkComponent = Link;

type Order = NonNullable<AdminClientDetail["orders"]>[number];
type Edition = AdminClientDetail["editions"][number];
type Limit = AdminClientDetail["saleAuthority"][number];
type Request = AdminClientDetail["requests"][number];
type Enquiry = NonNullable<AdminClientDetail["enquiries"]>[number];
type Payout = AdminClientDetail["payouts"][number];

const presentOrder = presentStatus("order");
const presentEdition = presentStatus("edition");
const presentCustody = presentStatus("custody");
const presentRequest = presentStatus("saleRequest");
const presentEnquiry = presentStatus("enquiry");
const presentPayout = presentStatus("payout");

const editions = (count: number) => (count === 1 ? "1 edition" : `${count} editions`);

function copy(value: string, noun: string) {
  void navigator.clipboard
    ?.writeText(value)
    .then(() => toast.success(`${noun} copied`))
    .catch(() => toast.error(`Could not copy the ${noun.toLowerCase()}`));
}

/**
 * A client's page on the staff record template: who they are in the header (their kind and
 * whether they have a LAX login as badges, email and joined date as facts), granting sale
 * authority as the one primary action, four figures said once, then their Shop and lax.art
 * records as related sections: orders, editions owned, sale limits, sale limit requests,
 * enquiries and payouts. Their bidding stays in Bid admin, linked from the header.
 */
export function ClientRecordPage({
  detail,
  canGrant,
  bidPublicUrl,
}: {
  detail: AdminClientDetail;
  canGrant: boolean;
  bidPublicUrl: string | undefined;
}) {
  const router = useRouter();
  const [granting, setGranting] = useState(false);
  const { party } = detail;
  const email = party.email ?? null;
  const bid = bidClientHref(bidPublicUrl, email);
  const kind = partyKindLabel(party.kind);
  const owned = useMemo(() => ownedArtworkOptions(detail.editions), [detail.editions]);

  const overflow: OverflowAction[] = [
    {
      id: "copy-id",
      label: "Copy client ID",
      icon: Copy,
      onSelect: () => copy(party.partyId, "Client ID"),
    },
    ...(email
      ? [
          {
            id: "copy-email",
            label: "Copy email",
            icon: Mail,
            onSelect: () => copy(email, "Email"),
          },
        ]
      : []),
  ];

  const orderColumns: DataColumn<Order>[] = [
    {
      id: "order",
      header: "Order",
      mobile: "title",
      cell: (row) => (
        <PrimaryCell
          href={`/orders/${row.orderId}`}
          Link={NextLink}
          secondary={row.lineCount === 1 ? "1 item" : `${row.lineCount} items`}
        >
          {orderNumber(row.orderId)}
        </PrimaryCell>
      ),
    },
    {
      id: "status",
      header: "Status",
      width: "168px",
      mobile: "badge",
      truncate: false,
      cell: (row) => <MappedStatusBadge status={row.status} present={presentOrder} />,
    },
    {
      id: "total",
      header: "Total",
      width: "128px",
      numeric: true,
      mobile: "meta",
      cell: (row) => <StaffMoney minor={row.totalPence} />,
    },
    {
      id: "placed",
      header: "Placed",
      width: "184px",
      mobile: "meta",
      truncate: false,
      cell: (row) => <StaffDate value={row.createdAt} withTime />,
    },
  ];

  const editionColumns: DataColumn<Edition>[] = [
    {
      id: "artwork",
      header: "Artwork",
      mobile: "title",
      cell: (row) => (
        <PrimaryCell
          href={`/artworks/${row.artworkId}`}
          Link={NextLink}
          secondary={`Edition ${row.editionNumber}`}
        >
          {row.artworkTitle}
        </PrimaryCell>
      ),
    },
    {
      id: "listing",
      header: "For sale",
      width: "152px",
      mobile: "badge",
      truncate: false,
      cell: (row) => <MappedStatusBadge status={row.listingStatus} present={presentEdition} />,
    },
    {
      id: "custody",
      header: "Where it is",
      width: "184px",
      mobile: "meta",
      truncate: false,
      cell: (row) => <MappedStatusBadge status={row.custodyStatus} present={presentCustody} />,
    },
  ];

  const limitColumns: DataColumn<Limit>[] = [
    {
      id: "artwork",
      header: "Artwork",
      mobile: "title",
      cell: (row) => (
        <PrimaryCell href={`/artworks/${row.artworkId}`} Link={NextLink}>
          {row.artworkTitle}
        </PrimaryCell>
      ),
    },
    {
      id: "listed",
      header: "Listed for sale",
      width: "144px",
      numeric: true,
      mobile: "meta",
      cell: (row) => editions(row.authorisedCount),
    },
    {
      id: "committed",
      header: "Reserved or sold",
      width: "152px",
      numeric: true,
      mobile: "meta",
      cell: (row) => editions(row.committedCount),
    },
    {
      id: "granted",
      header: "Last granted",
      width: "136px",
      mobile: "meta",
      truncate: false,
      cell: (row) => (row.lastGrantAt ? <StaffDate value={row.lastGrantAt} /> : null),
    },
  ];

  const requestColumns: DataColumn<Request>[] = [
    {
      id: "artwork",
      header: "Artwork",
      mobile: "title",
      cell: (row) => (
        <PrimaryCell
          href={`/requests?view=all&request=${row.requestId}`}
          Link={NextLink}
          secondary={requestedEditionsLabel(row.requestedCount)}
        >
          {row.artworkTitle}
        </PrimaryCell>
      ),
    },
    {
      id: "status",
      header: "Status",
      width: "168px",
      mobile: "badge",
      truncate: false,
      cell: (row) => <MappedStatusBadge status={row.status} present={presentRequest} />,
    },
    {
      id: "sent",
      header: "Sent",
      width: "136px",
      mobile: "meta",
      truncate: false,
      cell: (row) => <StaffDate value={row.createdAt} />,
    },
  ];

  const enquiryColumns: DataColumn<Enquiry>[] = [
    {
      id: "about",
      header: "About",
      mobile: "title",
      cell: (row) => (
        <PrimaryCell
          href={enquiryHref(row)}
          Link={NextLink}
          secondary={row.kind === "artwork" ? "Artwork enquiry" : null}
        >
          {enquirySubject(row)}
        </PrimaryCell>
      ),
    },
    {
      id: "status",
      header: "Status",
      width: "136px",
      mobile: "badge",
      truncate: false,
      cell: (row) => <MappedStatusBadge status={row.status} present={presentEnquiry} />,
    },
    {
      id: "sent",
      header: "Sent",
      width: "184px",
      mobile: "meta",
      truncate: false,
      cell: (row) => <StaffDate value={row.createdAt} withTime />,
    },
  ];

  const payoutColumns: DataColumn<Payout>[] = [
    {
      id: "source",
      header: "For",
      mobile: "title",
      cell: (row) => (
        <PrimaryCell href={`/payouts?payout=${row.payoutId}`} Link={NextLink}>
          {payoutSourceLabel(row.source)}
        </PrimaryCell>
      ),
    },
    {
      id: "status",
      header: "Status",
      width: "200px",
      mobile: "badge",
      truncate: false,
      cell: (row) => <MappedStatusBadge status={row.status} present={presentPayout} />,
    },
    {
      id: "amount",
      header: "Amount",
      width: "128px",
      numeric: true,
      mobile: "meta",
      cell: (row) => <StaffMoney minor={row.netPence} />,
    },
    {
      id: "due",
      header: "Due",
      width: "136px",
      mobile: "meta",
      truncate: false,
      cell: (row) => <StaffDate value={row.payoutDueAt} />,
    },
  ];

  const ordersAll = clientOrdersHref(email);

  return (
    <>
      <DetailPage
        breadcrumbs={
          <StaffBreadcrumbs
            Link={NextLink}
            items={[{ label: "Clients", href: "/clients" }, { label: party.displayName }]}
          />
        }
        title={party.displayName}
        status={
          <>
            <StatusBadge tone="neutral">{kind}</StatusBadge>
            {party.identitySubjectId ? null : (
              <StatusBadge tone="warning">No LAX login</StatusBadge>
            )}
          </>
        }
        meta={
          <>
            {email ? <MetaItem label="Email">{email}</MetaItem> : null}
            <MetaItem label="Joined">
              <StaffDate value={party.createdAt} className="text-staff-fg" />
            </MetaItem>
          </>
        }
        primaryAction={
          canGrant ? (
            <StaffButton
              variant="primary"
              icon={<ShieldCheck aria-hidden />}
              onClick={() => setGranting(true)}
            >
              Grant sale authority
            </StaffButton>
          ) : null
        }
        secondaryActions={
          bid ? (
            <StaffButton asChild variant="secondary" icon={<ExternalLink aria-hidden />}>
              <a href={bid}>Bidding in Bid admin</a>
            </StaffButton>
          ) : null
        }
        overflow={
          <OverflowMenu label={`More actions for ${party.displayName}`} actions={overflow} />
        }
      >
        <div className="flex flex-col gap-6">
          <StatGrid label={`${party.displayName} at a glance`} items={clientFigures(detail)} />
          <RelatedRecordsSection<Order>
            id="orders"
            title="Orders"
            columns={orderColumns}
            data={detail.orders ?? []}
            getRowId={(row) => row.orderId}
            defaultSort={{ columnId: "placed", direction: "desc" }}
            density="comfortable"
            onRowOpen={(row) => router.push(`/orders/${row.orderId}`)}
            viewAll={
              ordersAll && detail.orderCount !== undefined
                ? { href: ordersAll, total: detail.orderCount, Link: NextLink }
                : null
            }
            empty={{
              title: "No orders yet",
              description: "Orders they place in the Shop are listed here, newest first.",
            }}
          />
          <RelatedRecordsSection<Edition>
            id="editions"
            title="Editions owned"
            columns={editionColumns}
            data={detail.editions}
            getRowId={(row) => row.editionId}
            defaultSort={{ columnId: "artwork", direction: "asc" }}
            density="comfortable"
            onRowOpen={(row) => router.push(`/artworks/${row.artworkId}`)}
            empty={{
              title: "No editions owned",
              description: "Editions they buy or are given are listed here.",
            }}
          />
          <RelatedRecordsSection<Limit>
            id="sale-limits"
            title="Sale limits"
            description="How many of their editions of each artwork they may sell through LAX."
            columns={limitColumns}
            data={detail.saleAuthority}
            getRowId={(row) => row.artworkId}
            defaultSort={{ columnId: "artwork", direction: "asc" }}
            empty={{
              title: "No sale limits",
              description: canGrant
                ? "Grant sale authority to let them sell editions they own."
                : "Sale limits appear here once they are granted.",
            }}
          />
          <RelatedRecordsSection<Request>
            id="sale-requests"
            title="Sale limit requests"
            columns={requestColumns}
            data={detail.requests}
            getRowId={(row) => row.requestId}
            defaultSort={{ columnId: "sent", direction: "desc" }}
            density="comfortable"
            onRowOpen={(row) => router.push(`/requests?view=all&request=${row.requestId}`)}
            empty={{
              title: "No requests",
              description: "Requests they send from LAX Account to sell more editions appear here.",
            }}
          />
          <RelatedRecordsSection<Enquiry>
            id="enquiries"
            title="Enquiries"
            columns={enquiryColumns}
            data={detail.enquiries ?? []}
            getRowId={(row) => `${row.kind}:${row.enquiryId}`}
            defaultSort={{ columnId: "sent", direction: "desc" }}
            density="comfortable"
            onRowOpen={(row) => router.push(enquiryHref(row))}
            empty={{
              title: "No enquiries",
              description: "Enquiries they send from the Shop or lax.art appear here.",
            }}
          />
          <RelatedRecordsSection<Payout>
            id="payouts"
            title="Payouts"
            columns={payoutColumns}
            data={detail.payouts}
            getRowId={(row) => row.payoutId}
            defaultSort={{ columnId: "due", direction: "desc" }}
            onRowOpen={(row) => router.push(`/payouts?payout=${row.payoutId}`)}
            empty={{
              title: "No payouts",
              description: "Money owed to them after one of their editions sells appears here.",
            }}
          />
        </div>
      </DetailPage>
      {granting ? (
        <GrantSaleAuthorityDialog
          open
          onOpenChange={setGranting}
          client={{ id: party.partyId, label: party.displayName, description: email ?? kind }}
          ownedArtworks={owned}
        />
      ) : null}
    </>
  );
}
