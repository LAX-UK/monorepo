"use client";

import { FramingStepButton } from "@/components/orders/order-actions.client";
import { framingDueLabel, presentFramingTaskStatus } from "@/server/domain/order-detail.vm";
import { orderNumber } from "@/server/domain/order-list.vm";
import type { AdminFramingDueItem } from "@auction/shop-contracts";
import { Notice, Section, StatusBadge } from "@auction/staff-ui";
import Link from "next/link";

/** "Tide line, no. 7": the print a frame goes with. */
function printLabel(item: AdminFramingDueItem): string {
  return item.editionNumber === null
    ? item.printTitle
    : `${item.printTitle}, no. ${item.editionNumber}`;
}

/**
 * The frames still to make, soonest due first: what each is (as sold), the print it goes with, the
 * order, when it is due and the step that moves it on. One place to see what to frame and when.
 */
export function FramingDueList({
  items,
  failed = false,
}: {
  items: readonly AdminFramingDueItem[];
  /** The list could not be loaded; say so rather than show nothing as if no frames were due. */
  failed?: boolean;
}) {
  if (failed) {
    return (
      <Notice tone="danger" alert title="Frames due could not be loaded">
        The frames still to make are not shown. Reload the page to try again.
      </Notice>
    );
  }
  if (items.length === 0) return null;
  return (
    <Section
      title="Frames due"
      description={`${items.length} to make, soonest due first`}
      bodyClassName="p-0"
    >
      <ul className="divide-y divide-staff-line-subtle">
        {items.map((item) => {
          const presented = presentFramingTaskStatus(item.status);
          return (
            <li
              key={item.taskId}
              className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-staff-sm font-medium text-staff-fg">
                  Framing: {item.name}
                </p>
                <p className="text-staff-xs text-staff-muted">
                  {printLabel(item)} ·{" "}
                  <Link
                    href={`/orders/${item.orderId}`}
                    className="staff-focus rounded-staff-xs underline-offset-2 hover:underline"
                  >
                    Order {orderNumber(item.orderId, item.orderReference)}
                  </Link>
                </p>
                <p className="text-staff-xs text-staff-muted">{item.spec}</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <span className="whitespace-nowrap text-staff-xs text-staff-muted tabular-nums">
                  {framingDueLabel(item.dueAt)}
                </span>
                <StatusBadge tone={presented.tone}>{presented.label}</StatusBadge>
                {item.status === "queued" && !item.printStarted ? (
                  <span className="whitespace-nowrap text-staff-xs text-staff-muted">
                    Start the print first
                  </span>
                ) : (
                  <FramingStepButton task={item} label={`Framing: ${item.name}`} canMove />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
