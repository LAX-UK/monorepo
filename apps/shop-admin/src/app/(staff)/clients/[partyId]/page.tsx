import { GrantSaleAuthorityForm } from "@/components/admin-staff-action-forms.client";
import { AdminTable } from "@/components/shop-admin-shell";
import { formatAdminDetailDateTime, formatAdminDetailGbpPence } from "@/lib/admin-detail-format";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import type { AdminClientDetail } from "@auction/shop-contracts";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ partyId: string }>;
}) {
  const { partyId } = await params;
  const result = await fetchAdminJson<AdminClientDetail>(`clients/${partyId}`);
  if (result.status === "not_found") notFound();
  if (result.status !== "ok") {
    return <p className="text-sm text-red-700">Could not load client ({result.status}).</p>;
  }
  const data = result.data;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/clients" className="text-sm text-neutral-600 underline">
          ← Clients
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{data.party.displayName}</h1>
        <p className="text-sm text-neutral-600">
          {data.party.kind} · {data.party.partyId}
        </p>
      </div>

      <GrantSaleAuthorityForm
        defaultOwnerPartyId={data.party.partyId}
        artworkOptions={data.editions.map((row) => ({
          artworkId: row.artworkId,
          label: `${row.artworkTitle} · ed. ${row.editionNumber}`,
        }))}
      />

      <section>
        <h2 className="mb-3 text-lg font-medium">Editions owned</h2>
        <AdminTable
          columns={["Artwork", "Edition", "Listing", "Custody"]}
          rows={data.editions.map((row) => [
            row.artworkTitle,
            String(row.editionNumber),
            row.listingStatus,
            row.custodyStatus,
          ])}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Sale limits</h2>
        <AdminTable
          columns={["Artwork", "Authorised", "Committed", "Last grant"]}
          rows={data.saleAuthority.map((row) => [
            row.artworkTitle,
            String(row.authorisedCount),
            String(row.committedCount),
            row.lastGrantAt ? formatAdminDetailDateTime(row.lastGrantAt) : "—",
          ])}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Limit requests</h2>
        <AdminTable
          columns={["Artwork", "Requested", "Status", "Created"]}
          rows={data.requests.map((row) => [
            row.artworkTitle,
            String(row.requestedCount),
            row.status,
            formatAdminDetailDateTime(row.createdAt),
          ])}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Payouts</h2>
        <AdminTable
          columns={["Source", "Gross", "Net", "Status", "Due"]}
          rows={data.payouts.map((row) => [
            row.source,
            formatAdminDetailGbpPence(row.grossPence),
            formatAdminDetailGbpPence(row.netPence),
            row.status,
            row.payoutDueAt ? formatAdminDetailDateTime(row.payoutDueAt) : "—",
          ])}
        />
      </section>
    </div>
  );
}
