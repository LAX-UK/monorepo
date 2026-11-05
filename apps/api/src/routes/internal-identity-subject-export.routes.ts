import {
  SUBJECT_EXPORT_MANIFEST_SUBROUTE,
  SUBJECT_EXPORT_PAGE_SUBROUTE,
} from "@auction/identity-contracts";
import { Sentry } from "@auction/observability";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import type { ContainerInternalIdentitySubjectExportRoutesSlice } from "../container.js";
import type { Env } from "../env.js";
import { createSubjectExportMachineAuth } from "../middleware/subject-export-machine-auth.js";
import { UnknownSubjectExportCategoryError } from "../subject-export/subject-export.service.js";
import { InvalidSubjectExportCursorError } from "../subject-export/subject-export.types.js";

/**
 * Answers Identity's "download my data" questions for LAX Bid: what is held about a person
 * (manifest), then one category at a time. Mounted under `/internal/identity` and machine
 * authenticated with the `subject_export` credential; the routes come from the shared contract.
 * Responses carry personal data, so they are never cached.
 */
export function createInternalIdentitySubjectExportRoutes(
  container: ContainerInternalIdentitySubjectExportRoutesSlice,
  env: Pick<Env, "IDENTITY_SUBJECT_EXPORT_CLIENT_ID" | "IDENTITY_SUBJECT_EXPORT_CLIENT_SECRET">,
) {
  const routes = new Hono();
  // Scoped to this group's own paths; the /internal/identity prefix is shared with groups that use
  // the identity credential, which must never be able to read personal data.
  const auth = createSubjectExportMachineAuth(env);
  const noStore = createMiddleware(async (c, next) => {
    await next();
    c.header("Cache-Control", "no-store");
  });
  for (const path of [SUBJECT_EXPORT_MANIFEST_SUBROUTE, SUBJECT_EXPORT_PAGE_SUBROUTE]) {
    routes.use(path, auth, noStore);
  }

  routes.get(SUBJECT_EXPORT_MANIFEST_SUBROUTE, async (c) => {
    try {
      return c.json(await container.subjectExportService.manifest(c.req.param("subjectId")));
    } catch (error) {
      Sentry.captureException(error);
      return c.json({ error: "subject_export_unavailable" }, 503);
    }
  });

  routes.get(SUBJECT_EXPORT_PAGE_SUBROUTE, async (c) => {
    try {
      return c.json(
        await container.subjectExportService.page(
          c.req.param("subjectId"),
          c.req.param("category"),
          c.req.query("cursor") ?? null,
        ),
      );
    } catch (error) {
      if (error instanceof UnknownSubjectExportCategoryError) {
        return c.json({ error: "unknown_export_category" }, 404);
      }
      if (error instanceof InvalidSubjectExportCursorError) {
        return c.json({ error: "invalid_export_cursor" }, 400);
      }
      Sentry.captureException(error);
      return c.json({ error: "subject_export_unavailable" }, 503);
    }
  });

  return routes;
}
