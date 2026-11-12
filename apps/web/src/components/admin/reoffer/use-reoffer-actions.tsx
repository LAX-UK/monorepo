"use client";

import { returnToInventoryRequest } from "@/components/admin/lots/return-to-inventory-request";
import { useStaffConfirm } from "@/components/admin/staff/use-staff-confirm";
import {
  adminRecordSellerAnswerResultAction,
  adminSendReofferResultAction,
  adminStartReofferResultAction,
  adminWithdrawReofferResultAction,
} from "@/lib/actions/admin/admin-reoffers";
import type { ReofferActionId } from "@/lib/admin/reoffer/reoffer-card.vm";
import { formatStaffMoney } from "@auction/staff-ui";
import type { LotStatus } from "@auction/types";
import type { ReofferPreview, StaffReoffer } from "@auction/validators";
import { useCallback, useRef, useState } from "react";
import { RecordSellerAnswerDialog } from "./record-seller-answer-dialog";
import { SendOfferDialog } from "./send-offer-dialog";
import { useReofferStep } from "./use-reoffer-step";

export type ReofferLotTarget = { id: string; title: string; status: LotStatus };

type Context = { offer: StaffReoffer | null; preview: ReofferPreview };
type Open = { kind: "answer" | "send"; offer: StaffReoffer } | null;

/** What withdrawing means for each state, so staff know who is told. */
function withdrawText(offer: StaffReoffer): string {
  return offer.status === "offered"
    ? "The bidder is told the offer has been withdrawn and can no longer accept it. They owe nothing."
    : "The offer is closed and nobody is told. The bidder never heard about it.";
}

/**
 * Every step the Re-offer card can take: the ones that need a decision open a confirm, the ones
 * with their own fields open their dialog. Each runs a staff server action, which the API checks
 * again for permission and a recent sign-in. Returns `run` for the card and the dialogs to render.
 */
export function useReofferActions(lot: ReofferLotTarget) {
  const confirm = useStaffConfirm();
  const answerStep = useReofferStep();
  const sendStep = useReofferStep();
  const [open, setOpen] = useState<Open>(null);
  const startedStatus = useRef<"awaiting_seller" | "ready">("awaiting_seller");
  const { ask } = confirm;

  const withdraw = useCallback(
    (offer: StaffReoffer) =>
      ask({
        title: `Withdraw the offer to ${offer.bidder.accountName ?? "the next bidder"}?`,
        description: withdrawText(offer),
        confirmLabel: "Withdraw offer",
        tone: "danger",
        reason: {
          label: "Reason",
          description: "Kept in the audit log and with the lot.",
          maxLength: 1000,
        },
        stepUpAction: "withdraw this offer",
        run: ({ reason }) => adminWithdrawReofferResultAction(lot.id, offer.id, { note: reason }),
        success: "Offer withdrawn",
      }),
    [ask, lot.id],
  );

  const start = useCallback(
    (preview: ReofferPreview) => {
      const next = preview.next;
      ask({
        title: `Offer ${lot.title} to the next bidder?`,
        description: `${next?.accountName ?? "The next bidder"} bid ${
          next ? formatStaffMoney(next.bidMinor) : ""
        }. We ask the seller first, and nobody hears about the offer until the seller agrees and you send it.`,
        confirmLabel: "Offer to the next bidder",
        stepUpAction: "start this offer",
        run: async () => {
          const result = await adminStartReofferResultAction(lot.id);
          if (!result.ok) return result;
          startedStatus.current = result.data?.status ?? "awaiting_seller";
          return { ok: true };
        },
        success: () =>
          startedStatus.current === "ready"
            ? "Re-offer started: it is ready to send"
            : "Re-offer started: the seller has been asked",
      });
    },
    [ask, lot.id, lot.title],
  );

  const run = useCallback(
    (id: ReofferActionId, { offer, preview }: Context) => {
      switch (id) {
        case "start":
        case "next_bidder":
          return start(preview);
        case "record_answer":
          if (offer) setOpen({ kind: "answer", offer });
          return;
        case "send":
          if (offer) setOpen({ kind: "send", offer });
          return;
        case "withdraw":
          if (offer) withdraw(offer);
          return;
        case "return_to_inventory":
          return ask(returnToInventoryRequest(lot));
      }
    },
    [ask, lot, start, withdraw],
  );

  const closeDialog = () => {
    answerStep.clear();
    sendStep.clear();
    setOpen(null);
  };

  const dialogs = (
    <>
      {confirm.dialog}
      {open?.kind === "answer" ? (
        <RecordSellerAnswerDialog
          open
          offer={open.offer}
          busy={answerStep.busy}
          failure={answerStep.failure?.message ?? null}
          onOpenChange={(next) => {
            if (!next && !answerStep.busy) closeDialog();
          }}
          onSubmit={(body) =>
            answerStep.submit({
              run: () => adminRecordSellerAnswerResultAction(lot.id, open.offer.id, body),
              stepUpAction: "record the seller's answer",
              success: "Seller's answer recorded",
              onDone: closeDialog,
            })
          }
        />
      ) : null}
      {open?.kind === "send" ? (
        <SendOfferDialog
          open
          offer={open.offer}
          busy={sendStep.busy}
          failure={sendStep.failure}
          onOpenChange={(next) => {
            if (!next && !sendStep.busy) closeDialog();
          }}
          onChooseNext={() => {
            const offer = open.offer;
            closeDialog();
            withdraw(offer);
          }}
          onSend={(offerDays) =>
            sendStep.submit({
              run: () => adminSendReofferResultAction(lot.id, open.offer.id, { offerDays }),
              stepUpAction: "send this offer",
              success: `Offer sent to ${open.offer.bidder.accountName ?? "the next bidder"}`,
              onDone: closeDialog,
            })
          }
        />
      ) : null}
      {answerStep.stepUpDialog}
      {sendStep.stepUpDialog}
    </>
  );

  return { run, dialogs };
}
