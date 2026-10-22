import { AdminFailedPage } from "@/components/admin-fetch-state";
import { CreateProductionTaskForm } from "@/components/forms/operations/create-production-task-form.client";
import { ProductionQueue } from "@/components/production/production-queue.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson, loadAdminSession } from "@/server/application/load-admin-data";
import {
  parseProductionQueueQuery,
  productionQueueApiQuery,
} from "@/server/domain/production-queue.vm";
import type {
  AdminProductionAssigneesResponse,
  AdminProductionTaskList,
} from "@auction/shop-contracts";
import { PageHeader } from "@auction/ui";
import { redirect } from "next/navigation";

export const metadata = { title: "Production" };

export default async function ShopAdminProductionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseProductionQueueQuery(await searchParams);
  const [tasks, assignees, session] = await Promise.all([
    fetchAdminJson<AdminProductionTaskList>(
      adminListPath("production/tasks", { query: productionQueueApiQuery(query) }),
    ),
    fetchAdminJson<AdminProductionAssigneesResponse>("production/assignees"),
    loadAdminSession(),
  ]);
  if (
    tasks.status === "unauthorized" ||
    assignees.status === "unauthorized" ||
    session.status === "unauthorized"
  ) {
    redirect("/login");
  }
  if (tasks.status !== "ok") return <AdminFailedPage title="Production" status={tasks.status} />;
  if (assignees.status !== "ok" || session.status !== "ok") {
    return <AdminFailedPage title="Production" status="failed" />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Production"
        description="Made-to-order work for editions that have been sold but not yet produced."
      />
      <CreateProductionTaskForm />
      <section aria-labelledby="production-tasks-heading" className="flex flex-col gap-4">
        <h2 id="production-tasks-heading" className="text-lg font-medium text-on-surface">
          Tasks
        </h2>
        <ProductionQueue
          query={query}
          page={tasks.data}
          assignees={assignees.data.items}
          currentSubject={session.data.subject}
        />
      </section>
    </div>
  );
}
