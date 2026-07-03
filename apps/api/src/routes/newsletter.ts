import { newsletterSubscribeSchema } from "@auction/validators";
import { Hono } from "hono";
import type { ContainerNewsletterRoutesSlice } from "../container.js";
import { zValidator } from "../lib/z-validator.js";

export type { ZohoCampaignsSyncJobData } from "../services/newsletter-signup.service.js";

export function createNewsletterRoutes(container: ContainerNewsletterRoutesSlice) {
  const r = new Hono();

  r.post("/subscribe", zValidator("json", newsletterSubscribeSchema), async (c) => {
    const body = c.req.valid("json");
    const result = await container.newsletterSignupService.subscribe(body);
    return c.json({ ok: true, status: result.status });
  });

  return r;
}
