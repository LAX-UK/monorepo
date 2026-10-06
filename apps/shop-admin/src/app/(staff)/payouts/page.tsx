import { AdminFetchState } from "@/components/admin-fetch-state";
import { AdminListCursorNav } from "@/components/admin-list-cursor-nav";
import { MarkPayoutPaidForm } from "@/components/admin-staff-action-forms.client";
import { PayoutsStaffListTable } from "@/components/admin-staff-list-tables.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson } from "@/server/application/load-admin-data";
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

export default async function PayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;
  const result = await fetchAdminJson<PayoutList>(adminListPath("payouts", { cursor }));
  if (result.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-semibold">Payouts</h1>
        <AdminFetchState status={result.status} />
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Payouts</h1>
      <div className="mb-6 max-w-xl">
        <MarkPayoutPaidForm />
      </div>
      <PayoutsStaffListTable items={result.data.items} />
      <AdminListCursorNav pathname="/payouts" nextCursor={result.data.nextCursor} />
    </div>
  );
}
