import type { EnquiryStatus } from "./marketing-enquiry-vocabulary.js";
import { OPEN_ENQUIRY_STATUSES } from "./marketing-enquiry-vocabulary.js";

export const ENQUIRY_VIEWS = [
  "assigned_to_me",
  "open",
  "unassigned",
  "private_sales",
  "closed",
  "all",
] as const;
export type EnquiryView = (typeof ENQUIRY_VIEWS)[number];

/** What a view selects, and how it is ordered. */
export type EnquiryViewCriteria = {
  /** Null for every status. */
  statuses: readonly EnquiryStatus[] | null;
  assignee: "viewer" | "nobody" | "anyone";
  privateSaleOnly: boolean;
  /** Working views show the longest-waiting enquiry first; archives show the latest first. */
  order: "oldest_first" | "newest_first";
};

const WORKING = { statuses: OPEN_ENQUIRY_STATUSES, order: "oldest_first" } as const;

const VIEW_CRITERIA: Record<EnquiryView, EnquiryViewCriteria> = {
  assigned_to_me: { ...WORKING, assignee: "viewer", privateSaleOnly: false },
  open: { ...WORKING, assignee: "anyone", privateSaleOnly: false },
  unassigned: { ...WORKING, assignee: "nobody", privateSaleOnly: false },
  private_sales: { ...WORKING, assignee: "anyone", privateSaleOnly: true },
  closed: {
    statuses: ["closed", "converted"],
    assignee: "anyone",
    privateSaleOnly: false,
    order: "newest_first",
  },
  all: { statuses: null, assignee: "anyone", privateSaleOnly: false, order: "newest_first" },
};

export function enquiryViewCriteria(view: EnquiryView): EnquiryViewCriteria {
  return VIEW_CRITERIA[view];
}
