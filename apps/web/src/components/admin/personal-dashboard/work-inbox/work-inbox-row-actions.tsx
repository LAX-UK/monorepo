"use client";

import { executeWorkItemActionAction } from "@/lib/actions/admin/admin-work-item-actions";
import { redirectToHostedReauth } from "@/lib/auth/step-up/use-step-up-coordinator";
import type { AdminWorkItem, AdminWorkItemAction } from "@/lib/data/http/admin-work-items.schema";
import { notify } from "@/lib/ui/notify";
import { ConfirmActionDialog, Notice, useStaffStepUp } from "@auction/staff-ui";
import { Button } from "@auction/ui/components/button";
import { ConfirmDialog } from "@auction/ui/components/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@auction/ui/components/dropdown-menu";
import { ADMIN_REFUND_BUYER_REASON_MIN } from "@auction/validators";
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
  const [refunding, setRefunding] = useState(false);
  const [refundFailure, setRefundFailure] = useState<string | null>(null);
  const stepUp = useStaffStepUp({ onReauthenticate: redirectToHostedReauth });

  function executeAction(action: AdminWorkItemAction, onSuccess?: () => void, notes?: string) {
    startTransition(async () => {
      const result = await executeWorkItemActionAction({
        itemId: item.id,
        kind: item.kind,
        action,
        saleId: item.saleId ?? undefined,
        registrationId: item.kind === "sale_registration" ? entityId(item) : undefined,
        bookingId: item.kind === "telephone_booking" ? entityId(item) : undefined,
        ...(notes ? { notes } : {}),
      });
      if (result.ok) {
        notify.success(`${ACTION_LABELS[action]} completed`);
        onSuccess?.();
        router.refresh();
      } else if (action === "refund") {
        if (stepUp.handle(result, "Refund the payment")) setRefunding(false);
        else setRefundFailure(result.error);
      } else {
        notify.error(result.error);
      }
    });
  }

  function run(action: AdminWorkItemAction) {
    if (action === "refund") {
      // Money goes back to the buyer: the kit confirm, with a reason kept in the audit log.
      setRefundFailure(null);
      setRefunding(true);
      return;
    }
    if (CONFIRM_ACTIONS.has(action)) {
      setConfirmAction(action);
      return;
    }
    executeAction(action);
  }

  const refundDialog = (
    <>
      <ConfirmActionDialog
        open={refunding}
        onOpenChange={(open) => {
          if (!open && !pending) setRefunding(false);
        }}
        title={`Refund the payment for ${item.title}?`}
        description={
          <>
            {item.subtitle ? <span className="block">{item.subtitle}</span> : null}
            The buyer gets the full amount back on their original payment method. A refund cannot be
            undone.
          </>
        }
        confirmLabel="Refund payment"
        tone="danger"
        loading={pending}
        reason={{
          label: "Reason for the refund",
          description: "Kept in the audit log with your name.",
          minLength: ADMIN_REFUND_BUYER_REASON_MIN,
        }}
        onConfirm={({ reason }) => {
          setRefundFailure(null);
          executeAction("refund", () => setRefunding(false), reason);
        }}
      >
        {refundFailure ? (
          <Notice tone="danger" alert title="The refund did not go through">
            {refundFailure}
          </Notice>
        ) : null}
      </ConfirmActionDialog>
      {stepUp.dialog}
    </>
  );

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
        {refundDialog}
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
        {refundDialog}
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
      {refundDialog}
    </>
  );
}
