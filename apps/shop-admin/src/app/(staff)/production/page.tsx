import { AdminFailedPage } from "@/components/admin-fetch-state";
import { AdminListCursorNav } from "@/components/admin-list-cursor-nav";
import { AdminRecordTable } from "@/components/admin-staff-data-table";
import { CreateProductionTaskForm } from "@/components/forms/operations/create-production-task-form.client";
import { formatAdminDetailDateTime } from "@/lib/admin-detail-format";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson } from "@/server/application/load-admin-data";
import { PageHeader } from "@auction/ui";
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

export const metadata = { title: "Production" };

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
    return <AdminFailedPage title="Production" status={result.status} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Production"
        description="Made-to-order work for editions that have been sold but not yet produced."
      />
      <CreateProductionTaskForm />
      <section>
        <h2 className="mb-3 text-lg font-medium">Recent tasks</h2>
        <AdminRecordTable
          ariaLabel="Recent production tasks"
          columns={["Task", "Order line", "Edition", "Status", "Created"]}
          empty={{
            title: "No production tasks",
            description: "Create a task with the form above when an edition needs to be made.",
          }}
          rows={result.data.items.map((row) => ({
            id: row.taskId,
            cells: [
              row.taskId.slice(0, 8),
              row.orderLineId.slice(0, 8),
              row.editionId.slice(0, 8),
              row.status,
              formatAdminDetailDateTime(row.createdAt),
            ],
          }))}
        />
        <AdminListCursorNav
          cursor={cursor}
          pathname="/production"
          nextCursor={result.data.nextCursor}
        />
      </section>
    </div>
  );
}
