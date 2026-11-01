import { DisputesStaffList } from "@/components/admin/disputes/disputes-staff-list";
import type { DisputesListSearch } from "@/lib/admin/finance/disputes-staff-list.vm";
import { loadAdminDisputesListPage } from "@/lib/admin/finance/load-disputes-list-page";
import { paymentLinkAccess } from "@/lib/admin/finance/payment-link-access";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { UserRole } from "@auction/types";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Disputes",
  "Card disputes on Bid payments, their deadlines and how each falls on the invoices.",
);

export default async function AdminDisputesPage({
  searchParams,
}: {
  searchParams: Promise<DisputesListSearch>;
}) {
  const [page, sessionUser] = await Promise.all([
    searchParams.then((sp) => loadAdminDisputesListPage(sp)),
    getServerSessionUser(),
  ]);
  const { canOpenClient } = paymentLinkAccess(
    (sessionUser?.role ?? "client") as UserRole,
    sessionUser?.staffRoles,
  );

  return (
    <DisputesStaffList
      search={page.search}
      view={page.view}
      rows={page.rows}
      counts={page.counts}
      pageSize={page.pageSize}
      pagination={page.pagination}
      filtered={page.filtered}
      loadError={page.loadError}
      canOpenClient={canOpenClient}
    />
  );
}
