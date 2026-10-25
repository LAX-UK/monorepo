"use client";

import { useStaffConfirm } from "@/components/admin/staff/use-staff-confirm";
import {
  adminApproveWithdrawalRequestResultAction,
  adminCancelLotResultAction,
  adminDeclineWithdrawalRequestResultAction,
  adminPublishLotResultAction,
  adminReturnLotToInventoryResultAction,
  adminSoftDeleteLotResultAction,
} from "@/lib/actions/admin";
import { humanizeSetupError } from "@/lib/admin/sale-setup/humanize-setup-error";
import type { OverflowAction } from "@auction/staff-ui";
import type { LotStatus } from "@auction/types";
import { lotDeleteConfirmationPhrase } from "@auction/validators";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

/** What the lot actions need to know about a lot, from a list row or the lot page. */
export type LotActionTarget = {
  id: string;
  title: string;
  status: LotStatus;
  /** The lot's sale is still a draft: its lots are published with the sale. */
  inDraftSale: boolean;
  /** The API says this lot may be deleted (no bids, not live). */
  canDelete: boolean;
  /** Ended with a winner: it can no longer go back to inventory. */
  hasWinner: boolean;
  /** The seller asked to withdraw it, and the request is waiting for a decision. */
  withdrawalRequested: boolean;
  /** Why publishing is blocked (e.g. no photos), when it is. */
  publishBlockedReason?: string | null;
};

export type LotActionAccess = {
  canManageCatalog: boolean;
  canManageAuction: boolean;
  canDecideWithdrawals: boolean;
};

const WITHDRAWABLE: readonly LotStatus[] = ["draft", "scheduled", "active"];
const RETURNABLE: readonly LotStatus[] = ["ended", "cancelled", "voided"];

/**
 * A lot's state-changing actions, the same from a list row's `…` menu, the record panel and the
 * lot page: publish, decide a seller's withdrawal request, withdraw the lot, return it to
 * inventory and delete it. Each asks first through the kit confirm; withdrawing, returning and
 * declining take a reason, and deleting needs the lot's delete phrase typed. Actions a role can
 * never take are left out; ones the lot's state blocks are disabled with the reason.
 */
export function useLotActions(
  access: LotActionAccess,
  options: { afterDelete?: () => void; onConnectRequired?: (message: string) => void } = {},
) {
  const router = useRouter();
  const confirm = useStaffConfirm();
  const { ask } = confirm;
  const { afterDelete, onConnectRequired } = options;

  const publish = useCallback(
    (lot: LotActionTarget) => {
      const idempotencyKey = `lot-publish-${crypto.randomUUID()}`;
      ask({
        title: `Publish ${lot.title}?`,
        description:
          "The lot is scheduled and appears on the site when its sale timing says so. Publish only once the catalogue details are complete.",
        confirmLabel: "Publish lot",
        run: async () => {
          const result = await adminPublishLotResultAction(lot.id, idempotencyKey);
          return result.ok
            ? result
            : {
                ...result,
                error: humanizeSetupError({ message: result.error, errorCode: result.errorCode }),
              };
        },
        success: `${lot.title} published`,
        onFailure: (failure) => {
          if (failure.errorCode !== "connect_required" || !onConnectRequired) return false;
          onConnectRequired(failure.error);
          return true;
        },
      });
    },
    [ask, onConnectRequired],
  );

  const withdraw = useCallback(
    (lot: LotActionTarget) =>
      ask({
        title: `Withdraw ${lot.title}?`,
        description:
          lot.status === "active"
            ? "Bidding stops now and the lot comes off the site. Bidders who bid are told it was withdrawn. This cannot be undone."
            : "The lot will not go on sale. It stays in the lists as withdrawn. This cannot be undone.",
        confirmLabel: "Withdraw lot",
        tone: "danger",
        reason: {
          label: "Reason for withdrawing",
          description: "Kept with the lot and in the audit log.",
          maxLength: 500,
        },
        stepUpAction: "withdraw this lot",
        run: ({ reason }) => adminCancelLotResultAction(lot.id, { reason }),
        success: `${lot.title} withdrawn`,
      }),
    [ask],
  );

  const approveWithdrawal = useCallback(
    (lot: LotActionTarget) =>
      ask({
        title: `Approve the seller's request to withdraw ${lot.title}?`,
        description:
          "The lot is withdrawn from its sale and the seller is told. This cannot be undone.",
        confirmLabel: "Approve and withdraw",
        tone: "danger",
        stepUpAction: "approve this withdrawal",
        run: () => adminApproveWithdrawalRequestResultAction(lot.id),
        success: `Withdrawal approved. ${lot.title} is withdrawn.`,
      }),
    [ask],
  );

  const declineWithdrawal = useCallback(
    (lot: LotActionTarget) =>
      ask({
        title: `Decline the request to withdraw ${lot.title}?`,
        description: "The lot stays in its sale. The seller is emailed your reason.",
        confirmLabel: "Decline and tell the seller",
        reason: {
          label: "Reason for the seller",
          description: "Sent to the seller as written.",
          maxLength: 1000,
        },
        stepUpAction: "decline this withdrawal",
        run: ({ reason }) => adminDeclineWithdrawalRequestResultAction(lot.id, reason),
        success: "Withdrawal declined. The seller has been told.",
      }),
    [ask],
  );

  const returnToInventory = useCallback(
    (lot: LotActionTarget) =>
      ask({
        title: `Return ${lot.title} to inventory?`,
        description:
          "Takes the lot out of its sale and clears its lot number, winner and price back to the starting price. Its bid history is kept, marked as not winning.",
        confirmLabel: "Return to inventory",
        tone: "danger",
        reason: { label: "Reason", description: "Kept in the audit log.", maxLength: 500 },
        run: ({ reason }) =>
          adminReturnLotToInventoryResultAction(lot.id, {
            reason,
            confirmVoided: lot.status === "voided",
          }),
        success: `${lot.title} returned to inventory`,
      }),
    [ask],
  );

  const remove = useCallback(
    (lot: LotActionTarget) => {
      const phrase = lotDeleteConfirmationPhrase(lot.title);
      ask({
        title: `Delete ${lot.title}?`,
        description:
          "The lot is removed from the catalogue; its record is kept for audit. To keep it visible as withdrawn, withdraw it instead.",
        confirmLabel: "Delete lot",
        tone: "danger",
        typedConfirmation: phrase,
        run: () => adminSoftDeleteLotResultAction(lot.id, phrase),
        success: `${lot.title} deleted`,
        ...(afterDelete ? { onSuccess: afterDelete } : {}),
      });
    },
    [ask, afterDelete],
  );

  const actionsFor = useCallback(
    (lot: LotActionTarget): OverflowAction[] => {
      const actions: OverflowAction[] = [];
      if (access.canManageCatalog && lot.status === "draft") {
        const blocked = lot.inDraftSale
          ? "Lots in a draft sale are published with the sale"
          : (lot.publishBlockedReason ?? null);
        actions.push({
          id: "publish",
          label: "Publish lot",
          onSelect: () => publish(lot),
          ...(blocked ? { disabledReason: blocked } : {}),
        });
      }
      if (access.canDecideWithdrawals && lot.withdrawalRequested) {
        actions.push(
          {
            id: "approve-withdrawal",
            label: "Approve withdrawal request",
            onSelect: () => approveWithdrawal(lot),
          },
          {
            id: "decline-withdrawal",
            label: "Decline withdrawal request",
            onSelect: () => declineWithdrawal(lot),
          },
        );
      }
      if (access.canManageAuction && WITHDRAWABLE.includes(lot.status)) {
        actions.push({
          id: "withdraw",
          label: "Withdraw lot…",
          tone: "danger",
          onSelect: () => withdraw(lot),
        });
      }
      if (access.canManageAuction && RETURNABLE.includes(lot.status)) {
        actions.push({
          id: "return",
          label: "Return to inventory…",
          tone: "danger",
          onSelect: () => returnToInventory(lot),
          ...(lot.hasWinner ? { disabledReason: "A sold lot stays with its buyer" } : {}),
        });
      }
      if (access.canManageAuction && lot.canDelete) {
        actions.push({
          id: "delete",
          label: "Delete lot…",
          tone: "danger",
          onSelect: () => remove(lot),
        });
      }
      return actions;
    },
    [access, publish, approveWithdrawal, declineWithdrawal, withdraw, returnToInventory, remove],
  );

  return {
    actionsFor,
    publish,
    withdraw,
    remove,
    dialogs: confirm.dialog,
    refresh: () => router.refresh(),
  };
}
