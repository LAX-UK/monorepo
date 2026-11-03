import "server-only";

import { getAdminEnquiry, getEnquiryAssignees } from "@/lib/data/http/admin-enquiries.reader";
import type { EnquiryAssignee, EnquiryView } from "@/lib/data/http/admin-enquiries.schema";

export type EnquiryPageModel =
  | { kind: "ready"; enquiry: EnquiryView; assignees: EnquiryAssignee[] }
  | { kind: "not_found" }
  | { kind: "forbidden" }
  | { kind: "unavailable" };

/** One enquiry with the staff it can be handed to; the kind says why there is no record to show. */
export async function loadAdminEnquiryPage(ref: string): Promise<EnquiryPageModel> {
  try {
    const [enquiry, assignees] = await Promise.all([getAdminEnquiry(ref), getEnquiryAssignees()]);
    return enquiry ? { kind: "ready", enquiry, assignees } : { kind: "not_found" };
  } catch (error) {
    return {
      kind: error instanceof Error && error.message === "forbidden" ? "forbidden" : "unavailable",
    };
  }
}
