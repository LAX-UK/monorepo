import type { UserRole } from "@auction/types";
import { enquiryIntakeSchema } from "@auction/validators";
import { Hono } from "hono";
import type { ContainerMarketingEnquiryRoutesSlice } from "../container.js";
import { zValidator } from "../lib/z-validator.js";
import { createContactEnquiryRateLimitMiddleware } from "../middleware/contact-enquiry-rate-limit.js";
import { createOptionalAuth } from "../middleware/optional-auth.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

/**
 * The enquiry endpoints for the contact form and the private sale enquiry page. The web form
 * checks its honeypot and its own rate limit before calling; these endpoints limit per client
 * address again and validate the message.
 */
export function createMarketingEnquiryRoutes(
  container: ContainerMarketingEnquiryRoutesSlice,
  authenticator: IAuthenticator,
) {
  const r = new Hono<{ Variables: { userId?: string; userRole?: string } }>();
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });

  r.post(
    "/",
    createContactEnquiryRateLimitMiddleware(container.rateLimitStore),
    createOptionalAuth(authenticator),
    zValidator("json", enquiryIntakeSchema),
    async (c) => {
      const userId = c.get("userId");
      const role = c.get("userRole");
      const viewer = userId && role ? { userId, role: role as UserRole } : null;
      const result = await container.enquirySubmission.submit(c.req.valid("json"), viewer);
      if (!result.ok) {
        return c.json({ error: result.error, code: result.code }, result.status as 403);
      }
      return c.json(
        { data: { id: result.id, reference: result.reference, replyBy: result.replyBy } },
        201,
      );
    },
  );

  /**
   * Starts an enquiry draft: a token the visitor uploads photos under until they send. Limited
   * like the form, in its own bucket, and asked for only when the first file is chosen.
   */
  r.post(
    "/drafts",
    createContactEnquiryRateLimitMiddleware(container.rateLimitStore, "contact-enquiry-draft"),
    (c) => {
      const { token, expiresAt } = container.enquiryDraftTokens.issue();
      return c.json({ data: { draftToken: token, expiresAt: expiresAt.toISOString() } }, 201);
    },
  );

  /** The organisations the signed-in person may send an enquiry for, beside their own name. */
  r.get("/organisations", requireAuth, async (c) => {
    const organisations = await container.enquirerOrganisations.listFor(c.get("userId") as string);
    return c.json({ data: organisations });
  });

  return r;
}
