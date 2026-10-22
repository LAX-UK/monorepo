import { AdminBreadcrumbs } from "@/components/admin-breadcrumbs";
import { AdminFailedPage } from "@/components/admin-fetch-state";
import { ProductionHistory } from "@/components/production/production-history";
import { ProductionStatusBadge } from "@/components/production/production-status-badge";
import { ProductionTaskControls } from "@/components/production/production-task-controls.client";
import { formatAdminDetailDateTime } from "@/lib/admin-detail-format";
import { fetchAdminJson, loadAdminSession } from "@/server/application/load-admin-data";
import { orderNumber } from "@/server/domain/order-list.vm";
import { PRODUCTION_LIST_PATH, productionTaskTitle } from "@/server/domain/production-queue.vm";
import type {
  AdminProductionAssigneesResponse,
  AdminProductionTaskDetail,
} from "@auction/shop-contracts";
import { PageHeader } from "@auction/ui";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const metadata = { title: "Production task" };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ProductionTaskPage({ params }: { params: Promise<{ id: string }> }) {
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

  const detail = task.data;
  const title = productionTaskTitle(detail);

  return (
    <div className="space-y-8">
      <PageHeader
        breadcrumbs={
          <AdminBreadcrumbs
            list={{ label: "Production", href: PRODUCTION_LIST_PATH }}
            current={title}
          />
        }
        title={title}
        meta={<ProductionStatusBadge status={detail.status} />}
        description={`Created ${formatAdminDetailDateTime(detail.createdAt)}`}
      />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section
          aria-labelledby="production-history-heading"
          className="flex min-w-0 flex-col gap-4"
        >
          <h2 id="production-history-heading" className="text-lg font-medium text-on-surface">
            History
          </h2>
          <ProductionHistory history={detail.history} />
        </section>
        <aside aria-label="Task details" className="flex min-w-0 flex-col gap-8">
          <section aria-labelledby="production-handling-heading" className="flex flex-col gap-4">
            <h2 id="production-handling-heading" className="text-lg font-medium text-on-surface">
              Handling
            </h2>
            <ProductionTaskControls
              task={detail}
              assignees={assignees.data.items}
              currentSubject={session.data.subject}
            />
          </section>
          <section aria-labelledby="production-order-heading">
            <h2 id="production-order-heading" className="mb-3 text-lg font-medium text-on-surface">
              Order
            </h2>
            <Link
              href={`/orders/${detail.orderId}`}
              className="text-sm text-primary underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Order {orderNumber(detail.orderId)}
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
