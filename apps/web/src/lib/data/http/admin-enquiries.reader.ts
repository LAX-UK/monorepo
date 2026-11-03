import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readDataEnvelope, readJsonBody, safeReadData } from "@/lib/data/http/envelope";
import {
  enquiryAssigneesSchema,
  enquiryListPageSchema,
  enquiryRoutingSchema,
  enquiryViewSchema,
} from "./admin-enquiries.schema";
import type {
  EnquiryAssignee,
  EnquiryListPage,
  EnquiryRule,
  EnquiryView,
} from "./admin-enquiries.schema";

/** One page of the Enquiries list; throws when the Bid API does not answer. */
export async function getAdminEnquiries(query: URLSearchParams): Promise<EnquiryListPage> {
  const res = await authedServerFetch(`/admin/enquiries?${query.toString()}`);
  if (res.status === 403) throw new Error("forbidden");
  if (!res.ok) throw new Error(`Enquiries unavailable: ${res.status}`);
  return readDataEnvelope(await readJsonBody(res), enquiryListPageSchema, "GET /admin/enquiries");
}

/** One enquiry by reference or id; null when there is none or the person may not see it. */
export async function getAdminEnquiry(ref: string): Promise<EnquiryView | null> {
  const res = await authedServerFetch(`/admin/enquiries/${encodeURIComponent(ref)}`);
  return safeReadData(res, enquiryViewSchema, {
    context: "GET /admin/enquiries/:ref",
    nullStatuses: [404],
    notOkMessage: (status) => (status === 403 ? "forbidden" : `Enquiry unavailable: ${status}`),
  });
}

/** The staff an enquiry may be given to. Empty when the Bid API does not answer. */
export async function getEnquiryAssignees(): Promise<EnquiryAssignee[]> {
  const res = await authedServerFetch("/admin/enquiry-assignees").catch(() => null);
  if (!res?.ok) return [];
  return readDataEnvelope(
    await readJsonBody(res),
    enquiryAssigneesSchema,
    "GET /admin/enquiry-assignees",
  ).assignees;
}

/** Who receives each department's enquiries. Empty when the Bid API does not answer. */
export async function getEnquiryRouting(): Promise<EnquiryRule[]> {
  const res = await authedServerFetch("/admin/enquiry-routing").catch(() => null);
  if (!res?.ok) return [];
  return readDataEnvelope(
    await readJsonBody(res),
    enquiryRoutingSchema,
    "GET /admin/enquiry-routing",
  ).rules;
}
