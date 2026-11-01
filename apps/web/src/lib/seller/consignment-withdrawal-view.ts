import { formatDate } from "@/lib/ui/format";
import { WITHDRAWAL_FORBIDDEN_MESSAGE } from "@auction/domain";
import type { ConsignmentWithdrawalPathKind, SellerAfterSaleView } from "@auction/types";

type Copy = {
  title: string;
  body: string;
  action: string;
  confirmTitle: string;
  confirmLabel: string;
  /** Shown above the withdrawal conditions in the confirmation. */
  confirmLead: string;
  done: string;
};

/** The words for each way of taking a consignment back; a new path is a new entry. */
const COPY: Record<Exclude<ConsignmentWithdrawalPathKind, "unavailable" | "requested">, Copy> = {
  withdraw_now: {
    title: "Withdraw this consignment",
    body: "You can take the work back until it is catalogued.",
    action: "Withdraw consignment",
    confirmTitle: "Withdraw this consignment?",
    confirmLabel: "Withdraw",
    confirmLead:
      "The work is not catalogued yet, so it is withdrawn straight away. These conditions apply:",
    done: "Consignment withdrawn",
  },
  request: {
    title: "Ask to withdraw this lot",
    body: "The work is catalogued, so withdrawing it needs our agreement. A specialist reads your request and replies; the lot stays in the sale until then.",
    action: "Ask to withdraw",
    confirmTitle: "Ask to withdraw this lot?",
    confirmLabel: "Send request",
    confirmLead: "A specialist decides and replies. If they agree, these conditions apply:",
    done: "Request sent. A specialist will reply.",
  },
};

export type ConsignmentWithdrawalViewModel =
  | { mode: "hidden" }
  | { mode: "requested"; message: string }
  | {
      mode: "available";
      copy: Copy;
      /** Why the person cannot act, when someone else in the organisation must. */
      blockedReason: string | null;
      /** A previous request staff declined, with their reason. */
      declined: string | null;
    };

export function consignmentWithdrawalViewModel(
  withdrawal: SellerAfterSaleView["withdrawal"],
): ConsignmentWithdrawalViewModel {
  const { path, request, canAct } = withdrawal;
  if (path === "unavailable") return { mode: "hidden" };
  if (path === "requested") {
    return {
      mode: "requested",
      message: `You asked to withdraw this lot on ${request ? formatDate(request.requestedAt) : "a recent date"}. A specialist will reply; the lot stays in the sale until they do.`,
    };
  }
  const declined =
    request?.status === "declined"
      ? `Your request on ${formatDate(request.requestedAt)} was declined${request.reason ? `: ${request.reason}` : "."}`
      : null;
  return {
    mode: "available",
    copy: COPY[path],
    blockedReason: canAct ? null : WITHDRAWAL_FORBIDDEN_MESSAGE[path],
    declined,
  };
}
