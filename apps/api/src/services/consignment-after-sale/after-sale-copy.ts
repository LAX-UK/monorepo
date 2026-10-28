import type { ConsignmentMoveAgreementEffect } from "@auction/domain";
import { formatMoneyMajor } from "@auction/email";
import type { UnsoldLotChoiceKind } from "@auction/types";
import type { ConsignmentUpdate } from "./consignment-update-notifier.js";

/** An amount as people say it: "£4,000", or "£4,250.50" when it has pence. */
export function displayMoney(amount: string, currency: string): string {
  const formatted = formatMoneyMajor(amount, currency) ?? amount;
  return formatted.replace(/\.00$/, "");
}

const ASKED_FOR: Record<UnsoldLotChoiceKind, string> = {
  relist: "relist",
  private_sale: "offer by private sale",
  collect: "return to you",
};

/** The seller's choice is recorded and waits for a specialist. */
export function unsoldChoiceRequestedUpdate(input: {
  submissionId: string;
  title: string;
  choice: UnsoldLotChoiceKind;
}): ConsignmentUpdate {
  return {
    submissionId: input.submissionId,
    title: "We have your choice",
    message: `You asked us to ${ASKED_FOR[input.choice]} "${input.title}". A specialist will confirm it with you.`,
  };
}

function confirmedOutcome(
  title: string,
  choice: UnsoldLotChoiceKind,
  reserve: string | null,
  currency: string,
): string {
  switch (choice) {
    case "relist":
      return reserve
        ? `"${title}" will be relisted with a reserve of ${displayMoney(reserve, currency)}.`
        : `"${title}" will be relisted with its current reserve.`;
    case "private_sale":
      return `"${title}" will be offered by private sale.`;
    case "collect":
      return `"${title}" will be returned to you. We'll be in touch to arrange collection.`;
  }
}

/** A specialist confirmed (or adjusted) what happens to an unsold lot. */
export function unsoldChoiceConfirmedUpdate(input: {
  submissionId: string;
  title: string;
  choice: UnsoldLotChoiceKind;
  reserve: string | null;
  currency: string;
  note: string | null;
}): ConsignmentUpdate {
  const outcome = confirmedOutcome(input.title, input.choice, input.reserve, input.currency);
  return {
    submissionId: input.submissionId,
    title: "Your specialist confirmed what happens next",
    message: input.note ? `${outcome} Note from your specialist: ${input.note}` : outcome,
  };
}

export function withdrawnUpdate(input: { submissionId: string; title: string }): ConsignmentUpdate {
  return {
    submissionId: input.submissionId,
    title: "Your consignment was withdrawn",
    message: `"${input.title}" was withdrawn. Nothing more happens with it unless you send it again.`,
  };
}

/** The specialist reviewing a consignment learns the seller took it back. */
export function withdrawnForSpecialistUpdate(input: {
  submissionId: string;
  title: string;
}): ConsignmentUpdate {
  return {
    submissionId: input.submissionId,
    title: "A seller withdrew a consignment",
    message: `The seller withdrew "${input.title}" before it was catalogued. It has left your review queue.`,
  };
}

export function withdrawalRequestedUpdate(input: {
  submissionId: string;
  title: string;
}): ConsignmentUpdate {
  return {
    submissionId: input.submissionId,
    title: "We have your withdrawal request",
    message: `You asked to withdraw "${input.title}" from sale. A specialist will reply, and the lot stays in the sale until they do.`,
  };
}

const AGREEMENT_AFTER_MOVE: Record<ConsignmentMoveAgreementEffect, string> = {
  none: "",
  carried: " Its consignment agreement now waits for an owner or admin of the organisation.",
  reset:
    " The consignment agreement accepted in your own name does not carry over, so an owner or admin of the organisation accepts it again.",
};

/** A personal consignment now belongs to an organisation, told to the person and its admins. */
export function consignmentMovedUpdate(input: {
  submissionId: string;
  title: string;
  organisationName: string;
  agreement: ConsignmentMoveAgreementEffect;
}): ConsignmentUpdate {
  return {
    submissionId: input.submissionId,
    title: `Moved to ${input.organisationName}`,
    message: `At your request, "${input.title}" now belongs to ${input.organisationName}.${AGREEMENT_AFTER_MOVE[input.agreement]}`,
  };
}

export function identityReminderUpdate(input: {
  submissionId: string;
  title: string;
  accountKind: "individual" | "organisation";
}): ConsignmentUpdate {
  return {
    submissionId: input.submissionId,
    title: "Your specialist is waiting on your identity check",
    message:
      input.accountKind === "organisation"
        ? `Your specialist is ready to accept "${input.title}" once LAX has checked the organisation's documents. Send any documents we asked for so the review can finish.`
        : `Your specialist is ready to accept "${input.title}" once your identity is verified. It takes a few minutes.`,
  };
}
