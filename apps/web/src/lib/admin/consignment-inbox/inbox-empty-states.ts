import type { ConsignmentInboxView } from "@auction/domain";
import type { ConsignmentInboxSummary } from "@auction/validators";
import { INBOX_PATH } from "./inbox-list-state";

export type InboxEmptyState = {
  title: string;
  description: string;
  action?: { label: string; href: string };
};

/** What each view says when it holds nothing, and the one step that helps from there. */
export function inboxEmptyState(
  view: ConsignmentInboxView,
  summary: ConsignmentInboxSummary | null,
): InboxEmptyState {
  switch (view) {
    case "unanswered":
      return {
        title: "Every client has an answer",
        description: "New client messages about consignments appear here, longest waiting first.",
        action: { label: "See all threads", href: `${INBOX_PATH}?view=all` },
      };
    case "mine": {
      const unassigned = summary?.unassigned.waiting ?? 0;
      return {
        title: "Nothing assigned to you",
        description:
          unassigned > 0
            ? `Threads on consignments you specialise in come to you automatically. ${unassigned} ${unassigned === 1 ? "thread is" : "threads are"} waiting unassigned.`
            : "Threads on consignments you specialise in come to you automatically.",
        ...(unassigned > 0
          ? { action: { label: "Show unassigned", href: `${INBOX_PATH}?specialist=unassigned` } }
          : {}),
      };
    }
    case "all":
      return {
        title: "No client messages yet",
        description:
          "When a gallery or private seller writes from a consignment, the thread starts here and goes to its specialist.",
      };
    case "closed":
      return {
        title: "No closed threads",
        description:
          "Close a thread when no reply is needed. It reopens by itself if the client writes again.",
      };
  }
}
