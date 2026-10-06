import { AdminFetchState } from "@/components/admin-fetch-state";
import { AdminListCursorNav } from "@/components/admin-list-cursor-nav";
import {
  ApproveSaleFeeForm,
  RecordThirdPartySaleForm,
} from "@/components/admin-staff-action-forms.client";
import { ThirdPartySalesStaffListTable } from "@/components/admin-staff-list-tables.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import { redirect } from "next/navigation";

type ThirdPartySaleList = {
  items: Array<{
    saleId: string;
    artworkTitle: string;
    editionNumber: number;
    status: string;
    grossPence: number;
  }>;
  nextCursor: string | null;
};

export default async function ThirdPartySalesPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;
  const result = await fetchAdminJson<ThirdPartySaleList>(
    adminListPath("third-party-sales", { cursor }),
  );
  if (result.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-semibold">Third-party sales</h1>
        <AdminFetchState status={result.status} />
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Third-party sales</h1>
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <RecordThirdPartySaleForm />
        <ApproveSaleFeeForm />
      </div>
      <ThirdPartySalesStaffListTable items={result.data.items} />
      <AdminListCursorNav pathname="/third-party-sales" nextCursor={result.data.nextCursor} />
    </div>
  );
}
