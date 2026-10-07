import { AdminFetchState } from "@/components/admin-fetch-state";
import { AdminListCursorNav } from "@/components/admin-list-cursor-nav";
import { CreateProductionTaskForm } from "@/components/admin-staff-action-forms.client";
import { AdminTable } from "@/components/shop-admin-shell";
import { formatAdminDetailDateTime } from "@/lib/admin-detail-format";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import { redirect } from "next/navigation";

type ProductionTaskList = {
  items: Array<{
    taskId: string;
    orderLineId: string;
    editionId: string;
    status: string;
    createdAt: string;
  }>;
  nextCursor: string | null;
};

export default async function ShopAdminProductionPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;
  const result = await fetchAdminJson<ProductionTaskList>(
    adminListPath("production/tasks", { cursor }),
  );
  if (result.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-semibold">Production tasks</h1>
        <AdminFetchState status={result.status} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Production tasks</h1>
      <CreateProductionTaskForm />
      <section>
        <h2 className="mb-3 text-lg font-medium">Recent tasks</h2>
        <AdminTable
          columns={["Task", "Order line", "Edition", "Status", "Created"]}
          rows={result.data.items.map((row) => [
            row.taskId.slice(0, 8),
            row.orderLineId.slice(0, 8),
            row.editionId.slice(0, 8),
            row.status,
            formatAdminDetailDateTime(row.createdAt),
          ])}
        />
        <AdminListCursorNav pathname="/production" nextCursor={result.data.nextCursor} />
      </section>
    </div>
  );
}
