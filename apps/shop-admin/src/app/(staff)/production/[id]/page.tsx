import { AdminFailedPage } from "@/components/admin-fetch-state";
import { ProductionTaskPage } from "@/components/production/production-task-page.client";
import { fetchAdminJson, loadAdminSession } from "@/server/application/load-admin-data";
import type {
  AdminProductionAssigneesResponse,
  AdminProductionTaskDetail,
} from "@auction/shop-contracts";
import { notFound, redirect } from "next/navigation";

export const metadata = { title: "Production task" };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ProductionTaskRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();

  const [task, assignees, session] = await Promise.all([
    fetchAdminJson<AdminProductionTaskDetail>(`production/tasks/${id}`),
    fetchAdminJson<AdminProductionAssigneesResponse>("production/assignees"),
    loadAdminSession(),
  ]);
  if (
    task.status === "unauthorized" ||
    assignees.status === "unauthorized" ||
    session.status === "unauthorized"
  ) {
    redirect("/login");
  }
  if (task.status === "not_found") notFound();
  if (task.status !== "ok") return <AdminFailedPage title="Production task" status={task.status} />;
  if (assignees.status !== "ok" || session.status !== "ok") {
    return <AdminFailedPage title="Production task" status="failed" />;
  }

  return (
    <ProductionTaskPage
      task={task.data}
      assignees={assignees.data.items}
      currentSubject={session.data.subject}
    />
  );
}
