"use client";

import { AssignPaddleDialog } from "@/components/admin/assign-paddle-dialog";
import { useStaffConfirm } from "@/components/admin/staff/use-staff-confirm";
import {
  adminDecideSaleRegistrationResultAction,
  adminSaleroomCheckInResultAction,
} from "@/lib/actions/admin";
import type { AdminSaleRegistrationRow } from "@/lib/data/http/admin-sale-registrations.types";
import { registrationBidderLabel } from "@/lib/data/view-models/sale-registrations-tab.vm";
import { saleroomCheckInErrorMessage } from "@/lib/saleroom/check-in-error-messages";
import type { OverflowAction } from "@auction/staff-ui";
import { useCallback, useState } from "react";

type Options = {
  saleId: string;
  /** The sale takes bidders in the room (onsite or hybrid): paddles and check-in apply. */
  saleroom: boolean;
  /** A hybrid sale marks guests present without a paddle; an onsite sale always gives one. */
  hybrid: boolean;
};

/**
 * What staff can do with one registration, the same from a row's `…` menu: approve, reject with a
 * reason, assign a paddle, mark present. Each asks first; a failure stays in the dialog.
 */
export function useSaleRegistrationActions({ saleId, saleroom, hybrid }: Options) {
  const confirm = useStaffConfirm();
  const { ask } = confirm;
  const [paddleRow, setPaddleRow] = useState<AdminSaleRegistrationRow | null>(null);

  const actionsFor = useCallback(
    (row: AdminSaleRegistrationRow): OverflowAction[] => {
      const bidder = registrationBidderLabel(row);
      const actions: OverflowAction[] = [
        {
          id: "client",
          label: "Open client",
          href: `/admin/clients/${encodeURIComponent(row.userId)}`,
        },
      ];
      if (row.status === "pending") {
        actions.unshift({
          id: "approve",
          label: "Approve",
          onSelect: () =>
            ask({
              title: `Approve ${bidder}?`,
              description: "They will be able to bid in this sale.",
              confirmLabel: "Approve",
              run: () =>
                adminDecideSaleRegistrationResultAction({
                  saleId,
                  registrationId: row.id,
                  decision: "approve",
                }),
              success: `${bidder} approved`,
            }),
        });
      }
      if (saleroom && row.status === "approved") {
        if (row.paddleNumber == null) {
          actions.unshift({
            id: "paddle",
            label: "Assign paddle",
            onSelect: () => setPaddleRow(row),
            ...(row.kycStatus === "approved"
              ? {}
              : { disabledReason: "Opens once the identity check is complete" }),
          });
        }
        if (hybrid && row.checkedInAt == null) {
          actions.unshift({
            id: "present",
            label: "Mark present",
            onSelect: () =>
              ask({
                title: `Mark ${bidder} present?`,
                description: "They are recorded as attending without an in-room paddle.",
                confirmLabel: "Mark present",
                run: async () => {
                  const result = await adminSaleroomCheckInResultAction({
                    saleId,
                    userId: row.userId,
                    buyerLegalEntityId: row.buyerLegalEntityId,
                    assignPaddle: false,
                  });
                  return result.ok
                    ? { ok: true }
                    : {
                        ok: false,
                        error: saleroomCheckInErrorMessage(result.errorCode, result.error),
                        errorCode: result.errorCode,
                      };
                },
                success: `${bidder} marked present`,
              }),
          });
        }
      }
      if (row.status === "pending") {
        actions.push({
          id: "reject",
          label: "Reject",
          tone: "danger",
          onSelect: () =>
            ask({
              title: `Reject ${bidder}'s registration?`,
              description:
                "They will not be able to bid in this sale unless they register again. The reason is kept with the registration.",
              confirmLabel: "Reject registration",
              tone: "danger",
              reason: {
                label: "Reason",
                description: "Why this registration is not accepted.",
                maxLength: 500,
              },
              run: ({ reason }) =>
                adminDecideSaleRegistrationResultAction({
                  saleId,
                  registrationId: row.id,
                  decision: "reject",
                  reason,
                }),
              success: `${bidder}'s registration rejected`,
            }),
        });
      }
      return actions;
    },
    [ask, saleId, saleroom, hybrid],
  );

  const dialogs = (
    <>
      {confirm.dialog}
      {paddleRow ? (
        <AssignPaddleDialog
          key={paddleRow.id}
          saleId={saleId}
          row={paddleRow}
          open
          onOpenChange={(open) => {
            if (!open) setPaddleRow(null);
          }}
        />
      ) : null}
    </>
  );

  return { actionsFor, dialogs };
}
