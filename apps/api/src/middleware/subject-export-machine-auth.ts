import { SUBJECT_EXPORT_MACHINE_SCOPE } from "@auction/identity-contracts";
import type { MiddlewareHandler } from "hono";
import type { Env } from "../env.js";
import { timingSafeSecretMatches } from "../lib/internal-cron-auth.js";

type SubjectExportMachineEnv = Pick<
  Env,
  "IDENTITY_SUBJECT_EXPORT_CLIENT_ID" | "IDENTITY_SUBJECT_EXPORT_CLIENT_SECRET"
>;

/**
 * Machine authentication for the subject-export routes. It accepts only the export credential
 * pair and only when the caller names the `subject_export` scope, so the deletion-eligibility
 * credential (a different pair and scope) cannot pull a person's data. Not configured means closed.
 */
export function createSubjectExportMachineAuth(env: SubjectExportMachineEnv): MiddlewareHandler {
  return async (c, next) => {
    if (!env.IDENTITY_SUBJECT_EXPORT_CLIENT_ID || !env.IDENTITY_SUBJECT_EXPORT_CLIENT_SECRET) {
      return c.json({ error: "subject_export_not_configured" }, 503);
    }
    if (
      !timingSafeSecretMatches(
        c.req.header("x-identity-client-id"),
        env.IDENTITY_SUBJECT_EXPORT_CLIENT_ID,
      ) ||
      !timingSafeSecretMatches(
        c.req.header("x-identity-client-secret"),
        env.IDENTITY_SUBJECT_EXPORT_CLIENT_SECRET,
      ) ||
      c.req.header("x-identity-client-scope") !== SUBJECT_EXPORT_MACHINE_SCOPE
    ) {
      return c.json({ error: "unauthorized" }, 401);
    }
    await next();
  };
}
