import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import type { BankTransferInstructions, PayPlan, PayPlanProgress } from "@auction/types";
import { formatGbp } from "@auction/ui";
import { PAY_COPY } from "./pay-copy";
import {
  type BankDetailRow,
  type PayLotVm,
  type PayMoneyVm,
  type PayPageVm,
  type PayVmContext,
  blankPayVm,
  entityLines,
  lotSubtitle,
} from "./pay-page.vm";

/** "231470" as banks write it, "23-14-70"; anything else is left as it came. */
export function formatSortCode(sortCode: string): string {
  const digits = sortCode.replace(/\D/g, "");
  return digits.length === 6 ? digits.replace(/(\d{2})(?=\d)/g, "$1-") : sortCode;
}

/**
 * A short string that changes when the payment moves: its stage, or the money received. A
 * payment that is no longer under way (paid, or let go) reads `none`.
 */
export function progressSignature(progress: PayPlanProgress | null): string {
  return progress ? `${progress.stage}:${progress.receivedPence}` : "none";
}

/** Whether the page should show a payment under way rather than a way to pay. */
export function paymentUnderWay(plan: PayPlan): PayPlanProgress | null {
  return plan.progress !== null && plan.payable.length === 0 ? plan.progress : null;
}

function detailRows(
  transfer: BankTransferInstructions,
  progress: PayPlanProgress,
): BankDetailRow[] {
  return [
    { label: PAY_COPY.transferAmount, value: formatGbp(progress.remainingPence), copy: null },
    {
      label: PAY_COPY.transferAccountName,
      value: transfer.accountName,
      copy: transfer.accountName,
    },
    {
      label: PAY_COPY.transferSortCode,
      value: formatSortCode(transfer.sortCode),
      copy: transfer.sortCode.replace(/\D/g, ""),
    },
    {
      label: PAY_COPY.transferAccountNumber,
      value: transfer.accountNumber,
      copy: transfer.accountNumber,
    },
    { label: PAY_COPY.transferReference, value: transfer.reference, copy: transfer.reference },
  ];
}

function lotVms(
  progress: PayPlanProgress,
  note: string,
  details: PayVmContext["details"],
): PayLotVm[] {
  const several = progress.lots.length > 1;
  return progress.lots.map((lot) => ({
    lotId: lot.lotId,
    title: lot.title,
    image: details[lot.lotId]?.image ?? null,
    detail: several ? { subtitle: lotSubtitle(lot), note, total: formatGbp(lot.totalPence) } : null,
    href: `${CLIENT_ROUTES.purchases}/${lot.lotId}`,
  }));
}

function heading(progress: PayPlanProgress, organisation: string | null) {
  const [only] = progress.lots;
  if (progress.lots.length === 1 && only) {
    return {
      title: PAY_COPY.titleOne(only.title),
      subtitle:
        [lotSubtitle(only), organisation ? PAY_COPY.payingFor(organisation) : null]
          .filter((part): part is string => Boolean(part))
          .join(" · ") || null,
    };
  }
  return {
    title: PAY_COPY.titleSeveral(progress.lots.length),
    subtitle: [
      progress.rail === "bank_transfer"
        ? PAY_COPY.transferSubtitle(progress.lots.length)
        : PAY_COPY.severalSubtitle(progress.lots.length),
      organisation ? PAY_COPY.payingFor(organisation) : null,
    ]
      .filter((part): part is string => Boolean(part))
      .join(" · "),
  };
}

function moneyFor(
  plan: PayPlan,
  progress: PayPlanProgress,
  transfer: BankTransferInstructions | null,
): PayMoneyVm {
  const base = { due: null, ...entityLines(plan.entity) };
  if (progress.stage === "confirming") {
    return {
      ...base,
      lines: [],
      totalLabel: PAY_COPY.beingPaid,
      total: formatGbp(progress.totalPence),
      meter: null,
    };
  }
  const part = progress.stage === "part_received";
  const share = PAY_COPY.receivedShare(progress.receivedPercent);
  return {
    ...base,
    lines: part
      ? [
          { label: PAY_COPY.transferTotal, amount: formatGbp(progress.totalPence) },
          { label: PAY_COPY.transferReceived, amount: `−${formatGbp(progress.receivedPence)}` },
        ]
      : [],
    totalLabel: part ? PAY_COPY.transferLeftToSend : PAY_COPY.transferToSend,
    total: formatGbp(progress.remainingPence),
    meter: part
      ? {
          percent: progress.receivedPercent,
          label: PAY_COPY.partTitle(
            formatGbp(progress.receivedPence),
            formatGbp(progress.totalPence),
          ),
          caption: transfer ? `${share} · ${PAY_COPY.referenceCaption(transfer.reference)}` : share,
        }
      : null,
  };
}

/**
 * The page for a payment that is already under way: a card payment being confirmed, or a bank
 * transfer waiting for its money, in whole or in part. Every figure is the server's. There is no
 * way to pay again from here; the page reads the server's state until it moves.
 */
export function buildPayProgressVm(
  plan: PayPlan,
  progress: PayPlanProgress,
  context: PayVmContext,
  transfer: BankTransferInstructions | null,
): PayPageVm {
  const organisation = plan.account.kind === "organisation" ? plan.account.name : null;
  const isTransfer = progress.rail === "bank_transfer";
  const part = progress.stage === "part_received";
  // Only the people who pay send the money; others follow along without the account details.
  const wantsDetails = isTransfer && plan.payerRole === "payer";
  const { title, subtitle } = heading(progress, organisation);
  const note = isTransfer ? PAY_COPY.transferBadge : PAY_COPY.confirmingBadge;
  return {
    ...blankPayVm(),
    state: isTransfer ? "transfer" : "confirming",
    title,
    subtitle,
    badge: !isTransfer
      ? { label: PAY_COPY.confirmingBadge, tone: "info", shape: "dot" }
      : part
        ? { label: PAY_COPY.partBadge, tone: "warning", shape: "dot" }
        : { label: PAY_COPY.transferBadge, tone: "info", shape: "dot" },
    notices: part
      ? [
          {
            tone: "warning",
            title: PAY_COPY.partTitle(
              formatGbp(progress.receivedPence),
              formatGbp(progress.totalPence),
            ),
            detail: PAY_COPY.partBody(formatGbp(progress.remainingPence)),
          },
        ]
      : [],
    lots: lotVms(progress, note, context.details),
    money: moneyFor(plan, progress, transfer),
    back: { label: PAY_COPY.backToPurchases, href: CLIENT_ROUTES.purchases },
    progress: {
      stage: progress.stage,
      signature: progressSignature(progress),
      lotIds: progress.lots.map((lot) => lot.lotId),
      refreshHref: context.returnTo,
      contactHref: context.contactHref,
      details: wantsDetails && transfer ? { rows: detailRows(transfer, progress) } : null,
      detailsUnavailable: wantsDetails && transfer === null,
    },
  };
}
