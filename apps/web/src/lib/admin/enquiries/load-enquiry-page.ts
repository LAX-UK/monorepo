import "server-only";

import {
  getAdminEnquiry,
  getEnquiryAssignees,
  getEnquiryHistory,
} from "@/lib/data/http/admin-enquiries.reader";
import type {
  EnquiryAssignee,
  EnquiryHistoryEntry,
  EnquiryView,
} from "@/lib/data/http/admin-enquiries.schema";

export type EnquiryPageModel =
  | {
      kind: "ready";
      enquiry: EnquiryView;
      assignees: EnquiryAssignee[];
      /** Null when the audit trail could not be read; the page says so and shows the rest. */
      history: EnquiryHistoryEntry[] | null;
    }
  | { kind: "not_found" }
  | { kind: "forbidden" }
  | { kind: "unavailable" };

/** One enquiry with the staff it can be handed to; the kind says why there is no record to show. */
export async function loadAdminEnquiryPage(ref: string): Promise<EnquiryPageModel> {
  try {
    const [enquiry, assignees, history] = await Promise.all([
      getAdminEnquiry(ref),
      getEnquiryAssignees(),
      getEnquiryHistory(ref),
    ]);
    return enquiry ? { kind: "ready", enquiry, assignees, history } : { kind: "not_found" };
  } catch (error) {
    return {
      kind: error instanceof Error && error.message === "forbidden" ? "forbidden" : "unavailable",
    };
  }
}
