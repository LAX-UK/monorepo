import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { PAY_COPY } from "./pay-copy";
import type { PayLots } from "./pay-lots";
import { type PayPageVm, blankPayVm } from "./pay-page.vm";
import type { PayRefusal } from "./pay-plan-read";

const PURCHASES = { label: PAY_COPY.openPurchases, href: CLIENT_ROUTES.purchases } as const;

function messageVm(
  illustration: "parcel" | "lock",
  title: string,
  description: string,
  action: { label: string; href: string } = PURCHASES,
): PayPageVm {
  return { ...blankPayVm(), empty: { illustration, title, description, action } };
}

/** The page for a link that names no lot this page can ask about. */
export function payLinkProblemVm(lots: Exclude<PayLots, { kind: "lots" }>): PayPageVm {
  if (lots.kind === "none") {
    return messageVm("parcel", PAY_COPY.emptyTitle, PAY_COPY.emptyNoLots);
  }
  if (lots.kind === "invalid") {
    return messageVm("parcel", PAY_COPY.emptyTitle, PAY_COPY.emptyInvalid);
  }
  return messageVm("parcel", PAY_COPY.tooManyTitle, PAY_COPY.emptyTooMany);
}

const REFUSAL: Record<PayRefusal, { title: string; description: string }> = {
  suspended: {
    title: "Your account is suspended",
    description: "A suspended account can't make payments. Contact client services and we'll help.",
  },
  staff: {
    title: "Staff accounts don't pay for lots",
    description: "Payments are made from a buyer account. Switch to one to pay.",
  },
  no_role: {
    title: "Your role doesn't cover payments",
    description:
      "The owners, admins and finance team of this account pay its invoices. You'll see them move on once they have.",
  },
  bad_pick: {
    title: PAY_COPY.tooManyTitle,
    description: PAY_COPY.emptyTooMany,
  },
};

/** The page when the API will not plan a payment for this reader. */
export function payRefusalVm(reason: PayRefusal): PayPageVm {
  const copy = REFUSAL[reason];
  return messageVm("lock", copy.title, copy.description);
}
