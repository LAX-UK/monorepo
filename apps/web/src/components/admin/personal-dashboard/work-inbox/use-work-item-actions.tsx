"use client";

import { useStaffConfirm } from "@/components/admin/staff/use-staff-confirm";
import { executeWorkItemActionAction } from "@/lib/actions/admin/admin-work-item-actions";
import {
  WORK_ACTION_LABELS,
  workActionConfirm,
  workActionDone,
  workActionIsDestructive,
  workItemEntityId,
} from "@/lib/admin/dashboard/work-inbox.vm";
import type { AdminWorkItem, AdminWorkItemAction } from "@/lib/data/http/admin-work-items.schema";
import { notify } from "@/lib/ui/notify";
import { KeyValueList, type OverflowAction } from "@auction/staff-ui";
import { ADMIN_REFUND_BUYER_REASON_MIN } from "@auction/validators";
import { ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";

/** Runs one work item action through the server, as the inbox and its panel both do. */
export function runWorkItemAction(
  item: AdminWorkItem,
  action: AdminWorkItemAction,
  notes?: string,
) {
  return executeWorkItemActionAction({
    itemId: item.id,
    kind: item.kind,
    action,
    saleId: item.saleId ?? undefined,
    registrationId: item.kind === "sale_registration" ? workItemEntityId(item) : undefined,
    bookingId: item.kind === "telephone_booking" ? workItemEntityId(item) : undefined,
    ...(notes ? { notes } : {}),
  });
}

/**
 * A work item's actions for its `…` menu and its panel. Actions that move money, tell a customer
 * or cannot be taken back ask first through the kit confirm; a refund also asks for a reason kept
 * in the audit log, and a fresh sign-in when the API wants one. Quick actions run at once.
 */
export function useWorkItemActions({ onDone }: { onDone?: () => void } = {}) {
  const router = useRouter();
  const confirm = useStaffConfirm();
  const [running, startTransition] = useTransition();

  const run = useCallback(
    (item: AdminWorkItem, action: AdminWorkItemAction) => {
      if (action === "refund") {
        confirm.ask({
          title: `Refund the payment for ${item.title}?`,
          description:
            "The buyer gets the full amount back on their original payment method. A refund cannot be undone.",
          ...(item.subtitle
            ? { body: <KeyValueList items={[{ label: "Payment", value: item.subtitle }]} /> }
            : {}),
          confirmLabel: "Refund payment",
          cancelLabel: "Keep payment",
          tone: "danger",
          reason: {
            label: "Reason for the refund",
            description: "Kept in the audit log with your name.",
            minLength: ADMIN_REFUND_BUYER_REASON_MIN,
          },
          stepUpAction: "refund the payment",
          run: ({ reason }) => runWorkItemAction(item, action, reason),
          success: workActionDone(item, action),
          onSuccess: () => {
            onDone?.();
            router.refresh();
          },
        });
        return;
      }
      const ask = workActionConfirm(item, action);
      if (ask) {
        confirm.ask({
          ...ask,
          tone: workActionIsDestructive(action) ? "danger" : "default",
          run: () => runWorkItemAction(item, action),
          success: workActionDone(item, action),
          onSuccess: () => {
            onDone?.();
            router.refresh();
          },
        });
        return;
      }
      startTransition(async () => {
        const result = await runWorkItemAction(item, action);
        if (result.ok) {
          notify.success(workActionDone(item, action));
          onDone?.();
          router.refresh();
        } else {
          notify.error(result.error);
        }
      });
    },
    [confirm, onDone, router],
  );

  /** Every action the item offers, destructive last, then a link to its record. */
  const actionsFor = useCallback(
    (item: AdminWorkItem): OverflowAction[] => [
      ...item.actions.map((action) => ({
        id: action,
        label: WORK_ACTION_LABELS[action],
        ...(workActionIsDestructive(action) ? { tone: "danger" as const } : {}),
        disabled: running || confirm.busy,
        onSelect: () => run(item, action),
      })),
      { id: "open-record", label: "Open record", icon: ExternalLink, href: item.href },
    ],
    [confirm.busy, run, running],
  );

  return { run, actionsFor, running: running || confirm.busy, dialog: confirm.dialog };
}
