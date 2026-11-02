import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { safeReadData } from "@/lib/data/http/envelope";
import { z } from "zod";

export const adminEnquirySchema = z.object({
  id: z.string(),
  topic: z.string(),
  topicLabel: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  message: z.string(),
  sourcePage: z.string().nullable(),
  status: z.enum(["new", "handled"]),
  receivedAt: z.string(),
  handledAt: z.string().nullable(),
  replyDueAt: z.string(),
});
export type AdminEnquiry = z.infer<typeof adminEnquirySchema>;

/** One contact form enquiry, or null when there is none or the person may not see it. */
export async function getAdminEnquiry(id: string): Promise<AdminEnquiry | null> {
  const res = await authedServerFetch(`/admin/enquiries/${encodeURIComponent(id)}`);
  return safeReadData(res, adminEnquirySchema, {
    context: "GET /admin/enquiries/:id",
    nullStatuses: [404],
    notOkMessage: (status) => (status === 403 ? "forbidden" : `Enquiry unavailable: ${status}`),
  });
}
