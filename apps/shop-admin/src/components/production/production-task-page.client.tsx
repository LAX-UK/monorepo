"use client";

import {
  UNASSIGNED,
  useProductionTaskActions,
} from "@/components/production/use-production-task-actions.client";
import { presentProductionStatus } from "@/server/domain/order-detail.vm";
import { orderNumber } from "@/server/domain/order-list.vm";
import {
  PRODUCTION_LIST_PATH,
  productionAssigneeName,
  productionHistorySummary,
  productionTaskTitle,
} from "@/server/domain/production-queue.vm";
import type { AdminProductionTaskDetail, ProductionTaskStaff } from "@auction/shop-contracts";
import {
  CellLink,
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
            <MetaItem label="Order">
              <CellLink href={orderHref} Link={NextLink}>
                {orderNumber(task.orderId)}
              </CellLink>
            </MetaItem>
            <MetaItem label="Assignee">
              {task.assignee ? productionAssigneeName(task.assignee) : "Unassigned"}
            </MetaItem>
            <MetaItem label="Created">
              {formatStaffDateTime(task.createdAt, { zoneLabel: true })}
            </MetaItem>
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
            value: formatStaffDateTime(task.updatedAt, { zoneLabel: true }),
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
