"use client";

import { useStaffConfirm } from "@/components/admin/staff/use-staff-confirm";
import { adminSoftDeleteSaleResultAction } from "@/lib/actions/admin-sales";
import {
  adminCancelSaleResultAction,
  adminMarkSaleEndedResultAction,
  adminPublishSaleResultAction,
  adminUnpublishSaleResultAction,
} from "@/lib/admin/catalog-lifecycle/admin-catalog-lifecycle-mutations";
import { humanizeSetupError } from "@/lib/admin/sale-setup/humanize-setup-error";
import type { OverflowAction } from "@auction/staff-ui";
import type { SaleStatus } from "@auction/types";
import { saleDeleteConfirmationPhrase } from "@auction/validators";
import { useCallback } from "react";

/** What the sale actions need to know about a sale, from a list row or the sale page. */
export type SaleActionTarget = {
  id: string;
  title: string;
  status: SaleStatus;
  /** Run in a saleroom (onsite or hybrid), so staff end it by hand. */
  saleroom: boolean;
  /** The API says the sale may be deleted (a draft with nothing sold). */
  canDelete: boolean;
  /** Selling on ATG: it is published, cancelled and deleted there, not here. */
  sellingOnAtg: boolean;
  /** Why publishing is blocked (setup not finished), when it is. */
  publishBlockedReason?: string | null;
};

const ATG_REASON = "This sale is selling on ATG, so it is managed there";

/**
 * A sale's state-changing actions, the same from a list row's `…` menu and the sale page:
 * publish, revert to draft, end an onsite sale, cancel and delete. Each asks first through the
 * kit confirm; ending and cancelling take a reason (and a fresh sign-in when the API asks), and
 * deleting needs the sale's delete phrase typed. Actions the role can never take are left out.
 */
export function useSaleActions(
  { canManageSales }: { canManageSales: boolean },
  options: { afterDelete?: () => void; onConnectRequired?: (message: string) => void } = {},
) {
  const confirm = useStaffConfirm();
  const { ask } = confirm;
  const { afterDelete, onConnectRequired } = options;

  const publish = useCallback(
    (sale: SaleActionTarget) =>
      ask({
        title: `Publish ${sale.title}?`,
        description:
          "The sale and its lots are scheduled and appear to bidders on the site. Registrations open as set in the sale.",
        confirmLabel: "Publish sale",
        run: async () => {
          const result = await adminPublishSaleResultAction(sale.id);
          return result.ok
            ? result
            : {
                ...result,
                error: humanizeSetupError({ message: result.error, errorCode: result.errorCode }),
              };
        },
        success: `${sale.title} published`,
        onFailure: (failure) => {
          if (failure.errorCode !== "connect_required" || !onConnectRequired) return false;
          onConnectRequired(failure.error);
          return true;
        },
      }),
    [ask, onConnectRequired],
  );

  const unpublish = useCallback(
    (sale: SaleActionTarget) =>
      ask({
        title: `Revert ${sale.title} to draft?`,
        description:
          "The sale comes off the site and every scheduled lot in it goes back to draft. You can publish it again later.",
        confirmLabel: "Revert to draft",
        run: () => adminUnpublishSaleResultAction(sale.id),
        success: `${sale.title} is a draft again`,
      }),
    [ask],
  );

  const markEnded = useCallback(
    (sale: SaleActionTarget) =>
      ask({
        title: `End ${sale.title}?`,
        description:
          "The saleroom closes and every lot still open ends now. Results go to buyers and sellers. This cannot be undone.",
        confirmLabel: "End sale",
        tone: "danger",
        reason: {
          label: "Reason for ending",
          description: "Kept in the audit log.",
          maxLength: 500,
        },
        stepUpAction: "end this sale",
        run: ({ reason }) => adminMarkSaleEndedResultAction(sale.id, reason),
        success: `${sale.title} ended`,
      }),
    [ask],
  );

  const cancel = useCallback(
    (sale: SaleActionTarget) =>
      ask({
        title: `Cancel ${sale.title}?`,
        description:
          sale.status === "active"
            ? "Bidding stops now on every lot, and the sale comes off the site. Approved bidders may need a follow-up. This cannot be undone."
            : "The sale will not go ahead and its lots are cancelled with it. It stays in the lists as cancelled. This cannot be undone.",
        confirmLabel: "Cancel sale",
        cancelLabel: "Keep sale",
        tone: "danger",
        reason: {
          label: "Reason for cancelling",
          description: "Kept with the sale and in the audit log.",
          maxLength: 500,
        },
        stepUpAction: "cancel this sale",
        run: ({ reason }) => adminCancelSaleResultAction(sale.id, reason),
        success: `${sale.title} cancelled`,
      }),
    [ask],
  );

  const remove = useCallback(
    (sale: SaleActionTarget) => {
      const phrase = saleDeleteConfirmationPhrase(sale.title);
      ask({
        title: `Delete ${sale.title}?`,
        description:
          "The sale and its lots are removed from the catalogue; their records are kept for audit. To keep it visible as cancelled, cancel it instead.",
        confirmLabel: "Delete sale",
        tone: "danger",
        typedConfirmation: phrase,
        run: () => adminSoftDeleteSaleResultAction(sale.id, phrase),
        success: `${sale.title} deleted`,
        ...(afterDelete ? { onSuccess: afterDelete } : {}),
      });
    },
    [ask, afterDelete],
  );

  const actionsFor = useCallback(
    (sale: SaleActionTarget): OverflowAction[] => {
      if (!canManageSales) return [];
      const actions: OverflowAction[] = [];
      if (sale.status === "draft") {
        const blocked = sale.sellingOnAtg ? ATG_REASON : (sale.publishBlockedReason ?? null);
        actions.push({
          id: "publish",
          label: "Publish sale",
          onSelect: () => publish(sale),
          ...(blocked ? { disabledReason: blocked } : {}),
        });
      }
      if (sale.status === "scheduled") {
        actions.push({
          id: "unpublish",
          label: "Revert to draft",
          onSelect: () => unpublish(sale),
        });
      }
      if (sale.saleroom && (sale.status === "active" || sale.status === "scheduled")) {
        actions.push({
          id: "end",
          label: "End onsite sale…",
          tone: "danger",
          onSelect: () => markEnded(sale),
        });
      }
      if (sale.status === "draft" || sale.status === "scheduled" || sale.status === "active") {
        actions.push({
          id: "cancel",
          label: "Cancel sale…",
          tone: "danger",
          onSelect: () => cancel(sale),
          ...(sale.sellingOnAtg ? { disabledReason: ATG_REASON } : {}),
        });
      }
      if (sale.canDelete) {
        actions.push({
          id: "delete",
          label: "Delete sale…",
          tone: "danger",
          onSelect: () => remove(sale),
          ...(sale.sellingOnAtg ? { disabledReason: ATG_REASON } : {}),
        });
      }
      return actions;
    },
    [canManageSales, publish, unpublish, markEnded, cancel, remove],
  );

  return { actionsFor, publish, cancel, remove, dialogs: confirm.dialog };
}
