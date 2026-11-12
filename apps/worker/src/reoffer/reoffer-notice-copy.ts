import { LONDON_TIME_ZONE, formatWhen } from "@auction/datetime";
import { formatMoneyMajor } from "@auction/email";
import { gbpPenceToMajorString } from "@auction/finance-runtime";

/** The words of the notices the clock raises: a title and one message each. */
export type ReofferNoticeCopy = { title: string; message: string };

type CopyInput = { lot: string; at: Date; now: Date; amountPence: number };

const when = ({ at, now }: Pick<CopyInput, "at" | "now">) => formatWhen(at, LONDON_TIME_ZONE, now);

export function sellerReminderCopy(input: CopyInput): ReofferNoticeCopy {
  return {
    title: `Your answer is needed by ${when(input)}: ${input.lot}`,
    message: `We're waiting for your answer before we offer ${input.lot} to the next bidder. If we don't hear from you, we won't offer it, and we'll be in touch about what happens next.`,
  };
}

export function offerReminderCopy(input: CopyInput): ReofferNoticeCopy {
  const amount = formatMoneyMajor(gbpPenceToMajorString(input.amountPence));
  return {
    title: `Your offer for ${input.lot} ends tomorrow`,
    message: `Your offer to buy ${input.lot}${amount ? ` at ${amount}` : ""} ends on ${when(input)}. If you'd like it, review and accept the offer before then.`,
  };
}

export function offerEndedBidderCopy(input: CopyInput): ReofferNoticeCopy {
  return {
    title: `Your offer for ${input.lot} has ended`,
    message: `The offer to buy ${input.lot} ended on ${when(input)}. You don't owe anything. Thank you for bidding.`,
  };
}

export function offerEndedSellerCopy(input: CopyInput): ReofferNoticeCopy {
  return {
    title: `The next bidder didn't take up ${input.lot}`,
    message: `The next bidder didn't answer in time. We'll be in touch about the next step, and we'll ask you before the lot is offered again.`,
  };
}
