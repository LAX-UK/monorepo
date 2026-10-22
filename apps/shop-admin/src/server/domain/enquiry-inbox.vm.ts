import {
  ENQUIRY_KINDS,
  ENQUIRY_STATUSES,
  ENQUIRY_TOPICS,
  type EnquiryKind,
  type EnquiryStatus,
  type EnquiryTopic,
} from "@auction/shop-contracts";
import { staffRoleLabel } from "./staff-role-label.vm";

export const ENQUIRY_LIST_PATH = "/enquiries";

export { ENQUIRY_KINDS, ENQUIRY_STATUSES, ENQUIRY_TOPICS };

export type EnquiryAssigneeFilter = "me" | "unassigned";

/** The inbox's filter state, as it appears in the page URL. Every field is optional. */
export type EnquiryInboxQuery = {
  q?: string;
  kind?: EnquiryKind;
  topic?: EnquiryTopic;
  status?: EnquiryStatus;
  assignee?: EnquiryAssigneeFilter;
  cursor?: string;
};

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

export const ENQUIRY_STATUS_LABELS: Record<EnquiryStatus, string> = {
  new: "New",
  in_progress: "In progress",
  closed: "Closed",
};

export const ENQUIRY_ASSIGNEE_LABELS: Record<EnquiryAssigneeFilter, string> = {
  me: "Me",
  unassigned: "Unassigned",
};

type RawSearchParams = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  const trimmed = first?.trim();
  return trimmed ? trimmed : undefined;
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return allowed.find((candidate) => candidate === value);
}

/** Reads the URL, dropping anything unrecognised so a hand-edited link still opens the inbox. */
export function parseEnquiryInboxQuery(params: RawSearchParams): EnquiryInboxQuery {
  const q = single(params.q);
  const kind = oneOf(single(params.kind), ENQUIRY_KINDS);
  const topic = oneOf(single(params.topic), ENQUIRY_TOPICS);
  const status = oneOf(single(params.status), ENQUIRY_STATUSES);
  const assignee = oneOf(single(params.assignee), ["me", "unassigned"] as const);
  const cursor = single(params.cursor);
  return {
    ...(q ? { q } : {}),
    ...(kind ? { kind } : {}),
    ...(topic ? { topic } : {}),
    ...(status ? { status } : {}),
    ...(assignee ? { assignee } : {}),
    ...(cursor ? { cursor } : {}),
  };
}

/** True when any filter narrows the list; paging does not count. */
export function hasActiveEnquiryFilters(query: EnquiryInboxQuery): boolean {
  return Boolean(query.q || query.kind || query.topic || query.status || query.assignee);
}

function toSearchParams(query: EnquiryInboxQuery): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of ["q", "kind", "topic", "status", "assignee", "cursor"] as const) {
    const value = query[key];
    if (value) params.set(key, value);
  }
  return params;
}

/**
 * The inbox URL for `query` with `change` applied. Changing a filter returns to the first page,
 * because a cursor only means something under the filters it was issued for.
 * A `null` clears a field.
 */
export function enquiryInboxHref(
  query: EnquiryInboxQuery,
  change: { [K in keyof EnquiryInboxQuery]?: EnquiryInboxQuery[K] | null } = {},
): string {
  const next: Record<string, string | undefined> = { ...query, cursor: undefined };
  for (const [key, value] of Object.entries(change)) {
    next[key] = value ?? undefined;
  }
  const params = toSearchParams(next as EnquiryInboxQuery);
  const search = params.toString();
  return search ? `${ENQUIRY_LIST_PATH}?${search}` : ENQUIRY_LIST_PATH;
}

/** The same URL but one page further on. */
export function enquiryInboxPageHref(query: EnquiryInboxQuery, cursor: string): string {
  const params = toSearchParams({ ...query, cursor });
  return `${ENQUIRY_LIST_PATH}?${params.toString()}`;
}

/** The query string the inbox API expects for this URL state. */
export function enquiryInboxApiQuery(query: EnquiryInboxQuery): Record<string, string> {
  return Object.fromEntries(toSearchParams(query));
}

export type EnquiryBadgeTone = "warning" | "info" | "neutral";

export function enquiryStatusTone(status: EnquiryStatus): EnquiryBadgeTone {
  switch (status) {
    case "new":
      return "warning";
    case "in_progress":
      return "info";
    case "closed":
      return "neutral";
  }
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
