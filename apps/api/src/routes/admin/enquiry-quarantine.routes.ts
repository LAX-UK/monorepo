import {
  adminEnquiryQuarantineAttachSchema,
  adminEnquiryQuarantineDiscardSchema,
  adminEnquiryQuarantineListQuerySchema,
  enquiryQuarantineParamSchema,
} from "@auction/validators";
import { zValidator } from "../../lib/z-validator.js";
import { enquiryViewerOf } from "../../middleware/enquiry-viewer.js";
import { requireEnquiries, requireEnquiryWork } from "../../middleware/require-capability.js";
import type { AdminEnquiryRoutesContainer } from "../../services/interfaces/admin-routes/index.js";
import type { QuarantineReviewError } from "../../services/interfaces/enquiry-quarantine.js";
import type { AdminHono } from "./_shared.js";

const REVIEW_ERROR_STATUS = {
  quarantine_not_found: 404,
  review_forbidden: 403,
  already_reviewed: 409,
  enquiry_not_found: 422,
  enquiry_erased: 422,
  sender_confirmation_required: 422,
} as const satisfies Record<QuarantineReviewError, 403 | 404 | 409 | 422>;

/**
 * Inbound enquiry mail held back from every thread. Anyone who reads enquiries may read the held
 * mail they could read on a thread; attaching and discarding need the right to work enquiries,
 * checked here and again in the service. Both writes are audited there.
 */
export function attachAdminEnquiryQuarantineRoutes(
  platform: AdminHono,
  container: AdminEnquiryRoutesContainer,
): void {
  platform.use("/enquiry-quarantine", requireEnquiries);
  platform.use("/enquiry-quarantine/*", requireEnquiries);

  /** GET /admin/enquiry-quarantine — held mail, newest first, pending or reviewed. */
  platform.get(
    "/enquiry-quarantine",
    zValidator("query", adminEnquiryQuarantineListQuerySchema),
    async (c) => {
      const data = await container.admin.enquiryQuarantine.list(
        enquiryViewerOf(c),
        c.req.valid("query"),
      );
      c.header("Cache-Control", "no-store");
      return c.json({ data });
    },
  );

  /** GET /admin/enquiry-quarantine/:id — one held mail as plain text, with file metadata only. */
  platform.get(
    "/enquiry-quarantine/:id",
    zValidator("param", enquiryQuarantineParamSchema),
    async (c) => {
      const data = await container.admin.enquiryQuarantine.detail(
        enquiryViewerOf(c),
        c.req.valid("param").id,
      );
      if (!data) return c.json({ error: "quarantine_not_found" }, 404);
      c.header("Cache-Control", "no-store");
      return c.json({ data });
    },
  );

  /** POST /admin/enquiry-quarantine/:id/attach — file it on one enquiry, with a reason; audited. */
  platform.post(
    "/enquiry-quarantine/:id/attach",
    requireEnquiryWork,
    zValidator("param", enquiryQuarantineParamSchema),
    zValidator("json", adminEnquiryQuarantineAttachSchema),
    async (c) => {
      const result = await container.admin.enquiryQuarantine.attach(
        enquiryViewerOf(c),
        c.req.valid("param").id,
        c.req.valid("json"),
      );
      if (!result.ok) return c.json({ error: result.error }, REVIEW_ERROR_STATUS[result.error]);
      return c.json({
        data: { enquiryReference: result.enquiryReference, messageId: result.messageId },
      });
    },
  );

  /** POST /admin/enquiry-quarantine/:id/discard — leave it off every thread, with a reason; audited. */
  platform.post(
    "/enquiry-quarantine/:id/discard",
    requireEnquiryWork,
    zValidator("param", enquiryQuarantineParamSchema),
    zValidator("json", adminEnquiryQuarantineDiscardSchema),
    async (c) => {
      const result = await container.admin.enquiryQuarantine.discard(
        enquiryViewerOf(c),
        c.req.valid("param").id,
        c.req.valid("json"),
      );
      if (!result.ok) return c.json({ error: result.error }, REVIEW_ERROR_STATUS[result.error]);
      return c.json({ data: { ok: true } });
    },
  );
}
