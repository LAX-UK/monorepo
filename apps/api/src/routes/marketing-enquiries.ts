import { enquiryIntakeSchema } from "@auction/validators";
import { Hono } from "hono";
import type { ContainerMarketingEnquiryRoutesSlice } from "../container.js";
import { zValidator } from "../lib/z-validator.js";
import { createContactEnquiryRateLimitMiddleware } from "../middleware/contact-enquiry-rate-limit.js";

/**
 * The public enquiry endpoint, for the contact form and the private sale enquiry page. The web form checks its honeypot and its own rate limit
 * before calling; this endpoint limits per client address again and validates the message.
 */
export function createMarketingEnquiryRoutes(container: ContainerMarketingEnquiryRoutesSlice) {
  const r = new Hono();

  r.post(
    "/",
    createContactEnquiryRateLimitMiddleware(container.rateLimitStore),
    zValidator("json", enquiryIntakeSchema),
    async (c) => {
      const { id, reference } = await container.marketingEnquiryService.submit(c.req.valid("json"));
      return c.json({ data: { id, reference } }, 201);
    },
  );

  return r;
}
