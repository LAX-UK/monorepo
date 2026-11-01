import type { TabNavItem } from "@auction/ui/lax";
import {
  consignmentDocumentsHref,
  consignmentHistoryHref,
  consignmentHref,
  consignmentMessagesHref,
} from "./consignment-records";

export const CONSIGNMENT_DETAIL_TABS = ["overview", "messages", "documents", "history"] as const;
export type ConsignmentDetailTab = (typeof CONSIGNMENT_DETAIL_TABS)[number];

/** The tab an address asks for; anything else is the overview. */
export function consignmentDetailTab(param: string | undefined): ConsignmentDetailTab {
  return (CONSIGNMENT_DETAIL_TABS as readonly string[]).includes(param ?? "")
    ? (param as ConsignmentDetailTab)
    : "overview";
}

function messagesCount(messages: { total: number; unread: number } | null) {
  if (!messages || messages.total === 0) return {};
  return messages.unread > 0
    ? {
        count: messages.unread,
        countTone: "attention" as const,
        countLabel: messages.unread === 1 ? "unread message" : "unread messages",
      }
    : { count: messages.total, countLabel: messages.total === 1 ? "message" : "messages" };
}

/**
 * The consignment's tabs: Overview, Messages with how many there are, Documents with how many
 * files it keeps, and History. The messages count fills in ink while the specialist's newest
 * messages are unread, so it reads as waiting on the person. History has no count: every
 * consignment has one.
 */
export function consignmentDetailTabItems(input: {
  submissionId: string;
  /** `null` when the thread could not be read: the tab shows without a count. */
  messages: { total: number; unread: number } | null;
  /** How many files the Documents tab lists; `null` when they could not all be read. */
  documents?: number | null;
}): TabNavItem[] {
  const documents = input.documents ?? 0;
  return [
    { id: "overview", label: "Overview", href: consignmentHref(input.submissionId) },
    {
      id: "messages",
      label: "Messages",
      href: consignmentMessagesHref(input.submissionId),
      ...messagesCount(input.messages),
    },
    {
      id: "documents",
      label: "Documents",
      href: consignmentDocumentsHref(input.submissionId),
      ...(documents > 0
        ? { count: documents, countLabel: documents === 1 ? "document" : "documents" }
        : {}),
    },
    { id: "history", label: "History", href: consignmentHistoryHref(input.submissionId) },
  ];
}
