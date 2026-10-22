import { AdminBreadcrumbs } from "@/components/admin-breadcrumbs";
import { AdminFailedPage } from "@/components/admin-fetch-state";
import { GrantSaleAuthorityForm } from "@/components/admin-staff-action-forms.client";
import { AdminRecordTable } from "@/components/admin-staff-data-table";
import { formatAdminDetailDateTime, formatAdminDetailGbpPence } from "@/lib/admin-detail-format";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import type { AdminClientDetail } from "@auction/shop-contracts";
import { PageHeader } from "@auction/ui";
import { notFound, redirect } from "next/navigation";

export const metadata = { title: "Client" };

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ partyId: string }>;
}) {
  const { partyId } = await params;
  const result = await fetchAdminJson<AdminClientDetail>(`clients/${partyId}`);
  if (result.status === "unauthorized") redirect("/login");
  if (result.status === "not_found") notFound();
  if (result.status !== "ok") {
    return <AdminFailedPage title="Client" status={result.status} />;
  }
  const data = result.data;

  return (
    <div className="space-y-8">
      <PageHeader
        breadcrumbs={
          <AdminBreadcrumbs
            list={{ label: "Clients", href: "/clients" }}
            current={data.party.displayName}
          />
        }
        title={data.party.displayName}
        description={`${data.party.kind} · ${data.party.partyId}`}
      />

      <GrantSaleAuthorityForm
        defaultOwnerPartyId={data.party.partyId}
        artworkOptions={data.editions.map((row) => ({
          artworkId: row.artworkId,
          label: `${row.artworkTitle} · ed. ${row.editionNumber}`,
        }))}
      />

      <section>
        <h2 className="mb-3 text-lg font-medium">Editions owned</h2>
        <AdminRecordTable
          ariaLabel="Editions owned"
          columns={["Artwork", "Edition", "Listing", "Custody"]}
          empty={{
            title: "No editions owned",
            description: "Editions this client buys or is given will be listed here.",
          }}
          rows={data.editions.map((row) => ({
            id: row.editionId,
            cells: [
              row.artworkTitle,
              String(row.editionNumber),
              row.listingStatus,
              row.custodyStatus,
            ],
          }))}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Sale limits</h2>
        <AdminRecordTable
          ariaLabel="Sale limits"
          columns={["Artwork", "Authorised", "Committed", "Last grant"]}
          empty={{
            title: "No sale limits",
            description:
              "Grant sale authority with the form above to let this client sell editions.",
          }}
          rows={data.saleAuthority.map((row) => ({
            id: row.artworkId,
            cells: [
              row.artworkTitle,
              String(row.authorisedCount),
              String(row.committedCount),
              row.lastGrantAt ? formatAdminDetailDateTime(row.lastGrantAt) : "—",
            ],
          }))}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Limit requests</h2>
        <AdminRecordTable
          ariaLabel="Limit requests"
          columns={["Artwork", "Requested", "Status", "Created"]}
          empty={{
            title: "No limit requests",
            description: "Requests from this client for a higher sale limit will be listed here.",
          }}
          rows={data.requests.map((row) => ({
            id: row.requestId,
            cells: [
              row.artworkTitle,
              String(row.requestedCount),
              row.status,
              formatAdminDetailDateTime(row.createdAt),
            ],
          }))}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Payouts</h2>
        <AdminRecordTable
          ariaLabel="Payouts"
          columns={["Source", "Gross", "Net", "Status", "Due"]}
          empty={{
            title: "No payouts",
            description: "Money owed to this client after a sale will be listed here.",
          }}
          rows={data.payouts.map((row) => ({
            id: row.payoutId,
            cells: [
              row.source,
              formatAdminDetailGbpPence(row.grossPence),
              formatAdminDetailGbpPence(row.netPence),
              row.status,
              row.payoutDueAt ? formatAdminDetailDateTime(row.payoutDueAt) : "—",
            ],
          }))}
        />
      </section>
    </div>
  );
}
