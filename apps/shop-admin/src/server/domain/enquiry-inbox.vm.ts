import {
  ENQUIRY_KINDS,
  ENQUIRY_SEARCH_MAX_LENGTH,
  ENQUIRY_STATUSES,
  ENQUIRY_TOPICS,
  type EnquiryKind,
  type EnquiryTopic,
} from "@auction/shop-contracts";
import { staffRoleLabel } from "./staff-role-label.vm";
import { type WorkListState, defineWorkList } from "./work-list.vm";

export const ENQUIRY_LIST_PATH = "/enquiries";

export { ENQUIRY_KINDS, ENQUIRY_STATUSES, ENQUIRY_TOPICS };

export const ENQUIRY_KIND_LABELS: Record<EnquiryKind, string> = {
  general: "General",
  artwork: "Artwork",
};

export const ENQUIRY_TOPIC_LABELS: Record<EnquiryTopic, string> = {
  general: "General",
  private_viewing: "Private viewing",
  art_advisory: "Art advisory",
  selling: "Selling",
  exhibition: "Exhibition",
  artwork: "Artwork",
};

export const ENQUIRY_ASSIGNEE_LABELS = {
  me: "Me",
  unassigned: "Unassigned",
} as const;

/*
 * The enquiries list: a view per status (and all of them), search, kind, topic and assignee
 * filters, and the sort. The server always puts waiting enquiries first, then orders by the time
 * received. The panel names an enquiry as `kind:id` because ids are only unique per kind.
 */
export const enquiriesList = defineWorkList({
  path: ENQUIRY_LIST_PATH,
  views: [
    { id: "all", label: "All", api: {} },
    { id: "new", label: "Waiting", api: { status: "new" }, statuses: ["new"] },
    {
      id: "in_progress",
      label: "In progress",
      api: { status: "in_progress" },
      statuses: ["in_progress"],
    },
    { id: "closed", label: "Closed", api: { status: "closed" }, statuses: ["closed"] },
  ],
  defaultView: "all",
  filters: {
    kind: ENQUIRY_KINDS,
    topic: ENQUIRY_TOPICS,
    assignee: ["me", "unassigned"],
  },
  sorts: { received: { asc: "received_asc", desc: "received_desc" } },
  defaultSort: "received_desc",
  panelParam: "enquiry",
  searchMaxLength: ENQUIRY_SEARCH_MAX_LENGTH,
});

export type EnquiriesListState = WorkListState<"kind" | "topic" | "assignee">;

/** The panel id for an enquiry: `kind:id`. */
export function enquiryRef(item: { kind: EnquiryKind; id: string }): string {
  return `${item.kind}:${item.id}`;
}

export function parseEnquiryRef(
  value: string | null | undefined,
): { kind: EnquiryKind; id: string } | null {
  const [kind, id] = (value ?? "").split(":");
  const known = ENQUIRY_KINDS.find((candidate) => candidate === kind);
  return known && id ? { kind: known, id } : null;
}

/** The conversation page for an enquiry. */
export function enquiryPath(item: { kind: EnquiryKind; id: string }): string {
  return `${ENQUIRY_LIST_PATH}/${item.kind}/${item.id}`;
}

/** The headline for a sender: their name, else their email, so a row never reads as blank. */
export function enquirySenderName(sender: { name: string | null; email: string | null }): string {
  return sender.name?.trim() || sender.email?.trim() || "Unknown sender";
}

/** Shown under the name; omitted when the email already is the name. */
export function enquirySenderSecondary(sender: {
  name: string | null;
  email: string | null;
}): string | null {
  return sender.name?.trim() ? (sender.email?.trim() ?? null) : null;
}

/**
 * What staff see for a colleague: their name or email when we have one. Staff often have no
 * profile, so otherwise their role plus the end of their id keeps two people from reading alike.
 */
export function enquiryStaffName(person: {
  subject: string;
  label: string | null;
  role: string | null;
}): string {
  const label = person.label?.trim();
  if (label) return label;
  const suffix = person.subject.slice(-4);
  return person.role ? `${staffRoleLabel(person.role)} (${suffix})` : `Staff member (${suffix})`;
}
