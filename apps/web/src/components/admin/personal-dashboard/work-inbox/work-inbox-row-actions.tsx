"use client";

import { executeWorkItemActionAction } from "@/lib/actions/admin/admin-work-item-actions";
import type { AdminWorkItem, AdminWorkItemAction } from "@/lib/data/http/admin-work-items.schema";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
import { ConfirmDialog } from "@auction/ui/components/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@auction/ui/components/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const ACTION_LABELS: Record<AdminWorkItemAction, string> = {
  start_review: "Start review",
  approve: "Approve",
  reject: "Reject",
  assign_to_me: "Assign to me",
  mark_in_progress: "Claim",
  decline: "Decline",
  capture: "Capture",
  refund: "Refund",
  approve_registration: "Approve",
  reject_registration: "Reject",
  confirm_telephone: "Confirm",
  assign_clerk: "Assign to me",
  release_fulfilment: "Release",
  ready_for_collection: "Ready",
  delivered: "Delivered",
};

const CONFIRM_ACTIONS = new Set<AdminWorkItemAction>([
  "reject",
  "capture",
  "refund",
  "reject_registration",
  "release_fulfilment",
  "delivered",
]);

const DESTRUCTIVE_CONFIRM_ACTIONS = new Set<AdminWorkItemAction>([
  "reject",
  "refund",
  "reject_registration",
]);

function confirmTone(action: AdminWorkItemAction): "danger" | "warning" {
  return DESTRUCTIVE_CONFIRM_ACTIONS.has(action) ? "danger" : "warning";
}

type Props = {
  item: AdminWorkItem;
  layout: "inline" | "drawer";
};

function entityId(item: AdminWorkItem): string {
  const parts = item.id.split(":");
  return parts.length > 1 ? (parts[1] ?? item.id) : item.id;
}

export function WorkInboxRowActions({ item, layout }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmAction, setConfirmAction] = useState<AdminWorkItemAction | null>(null);

  function executeAction(action: AdminWorkItemAction, onSuccess?: () => void) {
    startTransition(async () => {
      const result = await executeWorkItemActionAction({
        itemId: item.id,
        kind: item.kind,
        action,
        saleId: item.saleId ?? undefined,
        registrationId: item.kind === "sale_registration" ? entityId(item) : undefined,
        bookingId: item.kind === "telephone_booking" ? entityId(item) : undefined,
      });
      if (result.ok) {
        notify.success(`${ACTION_LABELS[action]} completed`);
        onSuccess?.();
        router.refresh();
      } else {
        notify.error(result.error);
      }
    });
  }

  function run(action: AdminWorkItemAction) {
    if (CONFIRM_ACTIONS.has(action)) {
      setConfirmAction(action);
      return;
    }
    executeAction(action);
  }

  const confirmDialog =
    confirmAction !== null ? (
      <ConfirmDialog
        open
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
        title={`Confirm ${ACTION_LABELS[confirmAction]}`}
        body={`Confirm ${ACTION_LABELS[confirmAction]} for this item?`}
        confirmLabel={ACTION_LABELS[confirmAction]}
        tone={confirmTone(confirmAction)}
        loading={pending}
        onConfirm={() => {
          if (confirmAction) executeAction(confirmAction, () => setConfirmAction(null));
        }}
      />
    ) : null;

  if (item.actions.length === 0) {
    return (
      <>
        <Button asChild size="sm" variant="ghost">
          <a href={item.href}>Open</a>
        </Button>
        {confirmDialog}
      </>
    );
  }

  if (layout === "drawer") {
    return (
      <>
        <div className="flex flex-wrap gap-2">
          {item.actions.slice(0, 6).map((action) => (
            <Button
              key={action}
              size="sm"
              variant={action === "reject" || action === "refund" ? "outline" : "default"}
              disabled={pending}
              onClick={() => run(action)}
            >
              {pending ? "Working…" : ACTION_LABELS[action]}
            </Button>
          ))}
        </div>
        {confirmDialog}
      </>
    );
  }

  const [primary, ...overflow] = item.actions;
  if (!primary) return null;

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        <Button
          size="sm"
          variant={primary === "reject" || primary === "refund" ? "outline" : "default"}
          disabled={pending}
          onClick={() => run(primary)}
        >
          {pending ? "Working…" : ACTION_LABELS[primary]}
        </Button>
        {overflow.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="size-8 px-0"
                aria-label="More actions"
              >
                <MoreHorizontal className="size-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {overflow.map((action) => (
                <DropdownMenuItem key={action} disabled={pending} onClick={() => run(action)}>
                  {ACTION_LABELS[action]}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem asChild>
                <a href={item.href}>Open record</a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button asChild size="sm" variant="ghost">
            <a href={item.href}>Open</a>
          </Button>
        )}
      </div>
      {confirmDialog}
    </>
  );
}
