"use client";

import {
  UNASSIGNED,
  useProductionTaskActions,
} from "@/components/production/use-production-task-actions.client";
import {
  framingDueLabel,
  presentFramingTaskStatus,
  presentProductionStatus,
} from "@/server/domain/order-detail.vm";
import { orderNumber } from "@/server/domain/order-list.vm";
import {
  PRODUCTION_LIST_PATH,
  productionAssigneeName,
  productionHistorySummary,
  productionTaskTitle,
} from "@/server/domain/production-queue.vm";
import type { AdminProductionTaskDetail, ProductionTaskStaff } from "@auction/shop-contracts";
import { framingTaskFinished } from "@auction/shop-domain";
import {
  DetailPage,
  EnumSelect,
  Field,
  MappedStatusBadge,
  MetaItem,
  OverflowMenu,
  Section,
  StaffBreadcrumbs,
  StaffButton,
  type StaffLinkComponent,
  Timeline,
  formatStaffDateTime,
} from "@auction/staff-ui";
import { ReceiptText } from "@auction/staff-ui/icons";
import Link from "next/link";

const NextLink: StaffLinkComponent = Link;

/**
 * One production task on the staff record template: what it is and where it stands in the
 * header, its next move as the one primary action (the rest, and cancel, in the overflow), who
 * holds it, and its history newest first.
 */
export function ProductionTaskPage({
  task,
  assignees,
  currentSubject,
}: {
  task: AdminProductionTaskDetail;
  assignees: ProductionTaskStaff[];
  currentSubject: string;
}) {
  const actions = useProductionTaskActions({ assignees, currentSubject });
  const title = productionTaskTitle(task);
  const next = actions.nextStep(task);
  const others = actions.actionsFor(task, { skipNext: true });
  const orderHref = `/orders/${task.orderId}`;

  return (
    <>
      <DetailPage
        breadcrumbs={
          <StaffBreadcrumbs
            Link={NextLink}
            items={[{ label: "Production", href: PRODUCTION_LIST_PATH }, { label: title }]}
          />
        }
        title={title}
        status={<MappedStatusBadge status={task.status} present={presentProductionStatus} />}
        meta={
          <>
            <MetaItem label="Order">{orderNumber(task.orderId, task.orderReference)}</MetaItem>
            <MetaItem label="Created">{formatStaffDateTime(task.createdAt)}</MetaItem>
          </>
        }
        primaryAction={
          next ? (
            <StaffButton variant="primary" loading={actions.pending} onClick={next.run}>
              {next.label}
            </StaffButton>
          ) : null
        }
        secondaryActions={
          <StaffButton asChild variant="secondary" icon={<ReceiptText aria-hidden />}>
            <Link href={orderHref}>Open order</Link>
          </StaffButton>
        }
        overflow={
          others.length > 0 ? (
            <OverflowMenu label={`More actions for ${title}`} actions={others} />
          ) : null
        }
        notice={actions.error}
        summary={[
          {
            label: "Last change",
            value: formatStaffDateTime(task.updatedAt),
          },
          { label: "Task ID", value: task.taskId, copyValue: task.taskId },
        ]}
        rail={
          <Section title="Assignee">
            <Field label="Assigned to">
              <EnumSelect
                value={task.assignee?.subject ?? UNASSIGNED}
                options={actions.assigneeOptions(task)}
                disabled={actions.pending}
                onValueChange={(value) => actions.assign(task, value === UNASSIGNED ? null : value)}
              />
            </Field>
          </Section>
        }
      >
        {task.framing ? (
          <Section title="Framing">
            <p className="text-staff-sm font-medium text-staff-fg">Framing: {task.framing.name}</p>
            <p className="text-staff-sm text-staff-muted">{task.framing.spec}</p>
            <p className="mt-1 flex items-center gap-2 text-staff-xs text-staff-muted">
              <MappedStatusBadge status={task.framing.status} present={presentFramingTaskStatus} />
              {framingTaskFinished(task.framing.status) ? null : (
                <span className="tabular-nums">{framingDueLabel(task.framing.dueAt)}</span>
              )}
            </p>
            {framingTaskFinished(task.framing.status) ? null : (
              <p className="mt-2 text-staff-xs text-staff-muted">
                This print cannot pass quality check until the frame is done.
              </p>
            )}
          </Section>
        ) : null}
        <Section title="History">
          <Timeline
            label={`History of ${title}`}
            empty="No changes have been recorded yet."
            events={[...task.history].reverse().map((entry) => ({
              id: entry.id,
              title: productionHistorySummary(entry),
              at: entry.at,
              actor: productionAssigneeName(entry.actor),
            }))}
          />
        </Section>
      </DetailPage>
      {actions.dialogs}
    </>
  );
}
