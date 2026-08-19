import { Sentry } from "@auction/observability";
import { Hono } from "hono";
import type { ContainerInternalIdentitySubjectUsageRoutesSlice } from "../container.js";
import type { Env } from "../env.js";
import { createIdentityMachineAuth } from "../middleware/identity-machine-auth.js";

export function createInternalIdentitySubjectUsageRoutes(
  container: ContainerInternalIdentitySubjectUsageRoutesSlice,
  env: Pick<Env, "IDENTITY_MACHINE_CLIENT_ID" | "IDENTITY_MACHINE_CLIENT_SECRET">,
) {
  const routes = new Hono();
  routes.use("*", createIdentityMachineAuth(env));

  routes.get("/subject-usage/:subjectId", async (c) => {
    const subjectId = c.req.param("subjectId");
    if (!subjectId) {
      return c.json({ error: "subject_id_required" }, 400);
    }
    try {
      const usage = await container.subjectUsageReader.getSubjectUsage(subjectId);
      return c.json({ data: usage });
    } catch (error) {
      Sentry.captureException(error);
      return c.json({ error: "subject_usage_unavailable" }, 503);
    }
  });

  return routes;
}
