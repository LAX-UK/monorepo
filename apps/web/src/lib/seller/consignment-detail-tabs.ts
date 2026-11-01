import type { TabNavItem } from "@auction/ui/lax";
import { consignmentHref, consignmentMessagesHref } from "./consignment-records";

export const CONSIGNMENT_DETAIL_TABS = ["overview", "messages"] as const;
export type ConsignmentDetailTab = (typeof CONSIGNMENT_DETAIL_TABS)[number];

/** The tab an address asks for; anything else is the overview. */
export function consignmentDetailTab(param: string | undefined): ConsignmentDetailTab {
  return (CONSIGNMENT_DETAIL_TABS as readonly string[]).includes(param ?? "")
    ? (param as ConsignmentDetailTab)
    : "overview";
}

/**
 * The consignment's tabs: Overview, and Messages with how many there are. The count fills in ink
 * while the specialist's newest messages are unread, so it reads as waiting on the person.
 */
export function consignmentDetailTabItems(input: {
  submissionId: string;
  /** `null` when the thread could not be read: the tab shows without a count. */
  messages: { total: number; unread: number } | null;
}): TabNavItem[] {
  const messages = input.messages;
  return [
    { id: "overview", label: "Overview", href: consignmentHref(input.submissionId) },
    {
      id: "messages",
      label: "Messages",
      href: consignmentMessagesHref(input.submissionId),
      ...(messages && messages.total > 0
        ? messages.unread > 0
          ? {
              count: messages.unread,
              countTone: "attention" as const,
              countLabel: messages.unread === 1 ? "unread message" : "unread messages",
            }
          : { count: messages.total, countLabel: messages.total === 1 ? "message" : "messages" }
        : {}),
    },
  ];
}
