import { AdminFailedPage } from "@/components/admin-fetch-state";
import { AdminListCursorNav } from "@/components/admin-list-cursor-nav";
import { ClientsStaffListTable } from "@/components/admin-staff-list-tables.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson, loadAdminSession } from "@/server/application/load-admin-data";
import { clientListScope } from "@auction/shop-domain";
import { PageHeader } from "@auction/ui";
import { redirect } from "next/navigation";

type ClientList = {
  items: Array<{ partyId: string; displayName: string; kind: string }>;
  nextCursor: string | null;
};

export const metadata = { title: "Clients" };

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;
  const [result, session] = await Promise.all([
    fetchAdminJson<ClientList>(adminListPath("clients", { cursor })),
    loadAdminSession(),
  ]);
  if (result.status === "unauthorized" || session.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") {
    return <AdminFailedPage title="Clients" status={result.status} />;
  }

  return (
    <div>
      <PageHeader
        title="Clients"
        description={
          session.status === "ok" && clientListScope(session.data.capabilities) === "assigned"
            ? "The collectors and owners assigned to you."
            : "Collectors and owners, with their editions, sale limits and payouts."
        }
      />
      <ClientsStaffListTable items={result.data.items} />
      <AdminListCursorNav cursor={cursor} pathname="/clients" nextCursor={result.data.nextCursor} />
    </div>
  );
}
