import { AdminFailedPage } from "@/components/admin-fetch-state";
import { ProductionQueue } from "@/components/production/production-queue.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson, loadAdminSession } from "@/server/application/load-admin-data";
import { productionList } from "@/server/domain/sales-lists.vm";
import type {
  AdminProductionAssigneesResponse,
  AdminProductionTaskList,
} from "@auction/shop-contracts";
import { redirect } from "next/navigation";

export const metadata = { title: "Production" };

const EMPTY: AdminProductionTaskList = { items: [], nextCursor: null, counts: {} };

export default async function ShopAdminProductionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const state = productionList.parse(await searchParams);
  const [tasks, assignees, session] = await Promise.all([
    fetchAdminJson<AdminProductionTaskList>(
      adminListPath("production/tasks", {
        cursor: state.cursor,
        query: productionList.apiQuery(state),
      }),
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
  if (tasks.status === "forbidden" || tasks.status === "not_found") {
    return <AdminFailedPage title="Production" status={tasks.status} />;
  }
  if (session.status !== "ok") return <AdminFailedPage title="Production" status="failed" />;

  return (
    <ProductionQueue
      state={state}
      page={tasks.status === "ok" ? tasks.data : EMPTY}
      loadFailed={tasks.status === "failed" || assignees.status !== "ok"}
      assignees={assignees.status === "ok" ? assignees.data.items : []}
      currentSubject={session.data.subject}
    />
  );
}
