import { AdminFailedPage } from "@/components/admin-fetch-state";
import { AdminListCursorNav } from "@/components/admin-list-cursor-nav";
import { MarkPayoutPaidForm } from "@/components/admin-staff-action-forms.client";
import { PayoutsStaffListTable } from "@/components/admin-staff-list-tables.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import { PageHeader } from "@auction/ui";
import { redirect } from "next/navigation";

type PayoutList = {
  items: Array<{
    payoutId: string;
    ownerDisplayName: string;
    netPence: number;
    status: string;
    payoutDueAt: string;
  }>;
  nextCursor: string | null;
};

export const metadata = { title: "Payouts" };

export default async function PayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;
  const result = await fetchAdminJson<PayoutList>(adminListPath("payouts", { cursor }));
  if (result.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") {
    return <AdminFailedPage title="Payouts" status={result.status} />;
  }

  return (
    <div>
      <PageHeader
        title="Payouts"
        description="Money owed to artists and owners after a sale. Mark a payout as paid once the transfer has been made."
      />
      <div className="mb-6 max-w-xl">
        <MarkPayoutPaidForm />
      </div>
      <PayoutsStaffListTable items={result.data.items} />
      <AdminListCursorNav cursor={cursor} pathname="/payouts" nextCursor={result.data.nextCursor} />
    </div>
  );
}
