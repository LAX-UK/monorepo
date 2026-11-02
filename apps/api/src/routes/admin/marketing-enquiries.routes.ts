import { marketingEnquiryIdParamSchema } from "@auction/validators";
import { zValidator } from "../../lib/z-validator.js";
import { requireMarketingEnquiries } from "../../middleware/require-capability.js";
import type { AdminEnquiryRoutesContainer } from "../../services/interfaces/admin-routes/index.js";
import type { AdminHono } from "./_shared.js";

/**
 * Contact form enquiries for client services and administrators. Marking one handled is an
 * audited domain event with the person who did it.
 */
export function attachAdminMarketingEnquiryRoutes(
  platform: AdminHono,
  container: AdminEnquiryRoutesContainer,
): void {
  platform.use("/enquiries/*", requireMarketingEnquiries);

  /** GET /admin/enquiries/:id — what the sender wrote and how to reach them. */
  platform.get("/enquiries/:id", zValidator("param", marketingEnquiryIdParamSchema), async (c) => {
    const data = await container.admin.marketingEnquiries.detail(c.req.valid("param").id);
    if (!data) return c.json({ error: "enquiry_not_found" }, 404);
    return c.json({ data });
  });

  /** POST /admin/enquiries/:id/handled — client services replied or decided no reply is needed. */
  platform.post(
    "/enquiries/:id/handled",
    zValidator("param", marketingEnquiryIdParamSchema),
    async (c) => {
      const result = await container.admin.marketingEnquiries.markHandled(
        c.req.valid("param").id,
        c.get("userId") as string,
      );
      if (result.ok) return c.json({ data: result.enquiry });
      return c.json({ error: result.error }, result.error === "enquiry_not_found" ? 404 : 409);
    },
  );
}
