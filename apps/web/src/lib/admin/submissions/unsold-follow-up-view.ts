import { sellerMoney } from "@/lib/seller/consignment-agreement-view";
import { formatDate } from "@/lib/ui/format";
import type { UnsoldLotChoiceKind, UnsoldLotFollowUp } from "@auction/types";

/** What staff see about the work a confirmed choice leaves, and the one thing they can do. */
export type UnsoldFollowUpView = {
  title: string;
  detail: string;
  tone: "info" | "success";
  /** Label of the button that finishes the work; `null` when staff cannot finish it by hand. */
  action: string | null;
};

type KindCopy = {
  open: (followUp: UnsoldLotFollowUp, currency: string) => { title: string; detail: string };
  done: () => { title: string };
  action: string | null;
};

const KIND_COPY: Record<UnsoldLotChoiceKind, KindCopy> = {
  relist: {
    open: (followUp, currency) => ({
      title: "Next: return the lot to inventory",
      detail: followUp.reserve
        ? `Return it from the lot page. It takes the agreed reserve of ${sellerMoney(followUp.reserve, currency)}.`
        : "Return it from the lot page. It keeps the reserve it ended with.",
    }),
    done: () => ({ title: "Returned to inventory" }),
    action: null,
  },
  collect: {
    open: () => ({
      title: "Next: arrange the return",
      detail:
        "Agree collection or delivery with the seller. The lot cannot be relisted while it is confirmed for return.",
    }),
    done: () => ({ title: "Returned to the seller" }),
    action: "Mark as returned",
  },
  private_sale: {
    open: () => ({
      title: "Next: the private sales team follows this up",
      detail: "Mark it handled once the lot has been offered or handed to them.",
    }),
    done: () => ({ title: "Handled by the private sales team" }),
    action: "Mark as handled",
  },
};

export function unsoldFollowUpView(
  followUp: UnsoldLotFollowUp,
  currency: string,
): UnsoldFollowUpView {
  const copy = KIND_COPY[followUp.kind];
  if (followUp.status === "open") {
    return { ...copy.open(followUp, currency), tone: "info", action: copy.action };
  }
  const by = followUp.completedByName ? ` by ${followUp.completedByName}` : "";
  const on = followUp.completedAt ? `, ${formatDate(followUp.completedAt)}` : "";
  return {
    title: copy.done().title,
    detail: `Marked done${by}${on}.`,
    tone: "success",
    action: null,
  };
}
