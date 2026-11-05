import {
  ENQUIRY_ASSIGN_ACCESS,
  MARKETING_ENQUIRIES_ACCESS,
  PRIVATE_SALE_ENQUIRIES_READ_ACCESS,
  type StaffRoles,
  type UserRole,
  userHasAccessTo,
} from "@auction/types";
import {
  adminEnquiryListQuerySchema,
  adminEnquiryPatchSchema,
  adminEnquiryRoutingSchema,
  enquiryRefParamSchema,
  marketingEnquiryIdParamSchema,
} from "@auction/validators";
import type { Context } from "hono";
import { z } from "zod";
import { zValidator } from "../../lib/z-validator.js";
import {
  requireDataRequestsManage,
  requireEnquiries,
  requireEnquiryRoutingManage,
} from "../../middleware/require-capability.js";
import type { AdminEnquiryRoutesContainer } from "../../services/interfaces/admin-routes/index.js";
import type { EnquiryStaffViewer } from "../../services/interfaces/marketing-enquiry-service.js";
import type { AdminHono } from "./_shared.js";

/** What the signed-in person may read and do, from their capabilities. */
function viewerOf(c: Context): EnquiryStaffViewer {
  const role = c.get("userRole") as UserRole;
  const staff = c.get("userStaffRoles") as StaffRoles | undefined;
  return {
    userId: c.get("userId") as string,
    readsGeneral: userHasAccessTo(role, staff, MARKETING_ENQUIRIES_ACCESS),
    readsPrivateSale: userHasAccessTo(role, staff, PRIVATE_SALE_ENQUIRIES_READ_ACCESS),
    canAssign: userHasAccessTo(role, staff, ENQUIRY_ASSIGN_ACCESS),
  };
}

const enquiryErasureBodySchema = z.object({
  email: z.string().trim().email().max(320),
  confirmation: z.string().trim().max(320),
  reason: z.string().trim().min(5).max(500),
});

const UPDATE_ERROR_STATUS = {
  enquiry_not_found: 404,
  stale_version: 409,
  assign_forbidden: 403,
  assignee_invalid: 422,
  unchanged: 422,
  not_allowed: 422,
  close_reason_required: 422,
  close_reason_not_applicable: 422,
  close_reason_without_status: 422,
  conversion_unavailable: 422,
  conversion_not_manual: 422,
} as const;

/**
 * Enquiries for client services, specialists and administrators. Who sees which enquiry is
 * decided by the desk service; these routes carry the viewer's capabilities to it.
 */
export function attachAdminMarketingEnquiryRoutes(
  platform: AdminHono,
  container: AdminEnquiryRoutesContainer,
): void {
  platform.use("/enquiries", requireEnquiries);
  platform.use("/enquiries/*", requireEnquiries);
  platform.use("/enquiry-routing", requireEnquiries);
  platform.use("/enquiry-assignees", requireEnquiries);
  platform.use("/data-requests/enquiry-erasure", requireDataRequestsManage);

  /**
   * POST /admin/data-requests/enquiry-erasure: anonymise every enquiry from one email address.
   * Name, email, phone and message are replaced, notes cleared and files deleted. Enquiries tied
   * to a deal are held and counted. The address's email-only alert subscriptions are erased too.
   * Safe to repeat.
   */
  platform.post(
    "/data-requests/enquiry-erasure",
    zValidator("json", enquiryErasureBodySchema),
    async (c) => {
      c.header("Cache-Control", "no-store");
      const result = await container.admin.enquiryErasure.eraseByEmail({
        ...c.req.valid("json"),
        actorUserId: c.get("userId") as string,
      });
      if (!result.ok) return c.json({ error: result.error }, 422);
      const { ok: _ok, ...counts } = result;
      return c.json({ data: counts });
    },
  );

  /** GET /admin/enquiries — one page of a view, with filters. */
  platform.get("/enquiries", zValidator("query", adminEnquiryListQuerySchema), async (c) => {
    const data = await container.admin.marketingEnquiries.list(viewerOf(c), c.req.valid("query"));
    return c.json({ data });
  });

  /** GET /admin/enquiries/:ref — what the sender wrote, how to reach them, notes and attachments. */
  platform.get("/enquiries/:ref", zValidator("param", enquiryRefParamSchema), async (c) => {
    const data = await container.admin.marketingEnquiries.detail(
      viewerOf(c),
      c.req.valid("param").ref,
    );
    if (!data) return c.json({ error: "enquiry_not_found" }, 404);
    return c.json({ data });
  });

  /** PATCH /admin/enquiries/:ref — assign, change status, close with a reason, add a note. */
  platform.patch(
    "/enquiries/:ref",
    zValidator("param", enquiryRefParamSchema),
    zValidator("json", adminEnquiryPatchSchema),
    async (c) => {
      const result = await container.admin.marketingEnquiries.update(
        viewerOf(c),
        c.get("userId") as string,
        c.req.valid("param").ref,
        c.req.valid("json"),
      );
      if (result.ok) return c.json({ data: result.enquiry });
      return c.json(
        {
          error: result.error,
          ...(result.currentVersion !== undefined ? { currentVersion: result.currentVersion } : {}),
        },
        UPDATE_ERROR_STATUS[result.error],
      );
    },
  );

  /** POST /admin/enquiries/:id/handled — client services replied or decided no reply is needed. */
  platform.post(
    "/enquiries/:id/handled",
    zValidator("param", marketingEnquiryIdParamSchema),
    async (c) => {
      const result = await container.admin.marketingEnquiries.markHandled(
        viewerOf(c),
        c.req.valid("param").id,
        c.get("userId") as string,
      );
      if (result.ok) return c.json({ data: result.enquiry });
      return c.json({ error: result.error }, result.error === "enquiry_not_found" ? 404 : 409);
    },
  );

  /** GET /admin/enquiry-assignees — the staff an enquiry may be given to, by name. */
  platform.get("/enquiry-assignees", async (c) => {
    return c.json({ data: { assignees: await container.admin.enquiryRouting.assignees() } });
  });

  /** GET /admin/enquiry-routing — who receives each department's enquiries. */
  platform.get("/enquiry-routing", async (c) => {
    return c.json({ data: { rules: await container.admin.enquiryRouting.rules() } });
  });

  /** PUT /admin/enquiry-routing — replace the table; administrators and sales managers. */
  platform.put(
    "/enquiry-routing",
    requireEnquiryRoutingManage,
    zValidator("json", adminEnquiryRoutingSchema),
    async (c) => {
      const result = await container.admin.enquiryRouting.replace(
        c.get("userId") as string,
        c.req.valid("json").rules,
      );
      if (!result.ok) return c.json({ error: result.error, userId: result.userId }, 422);
      return c.json({ data: { rules: result.rules } });
    },
  );
}
