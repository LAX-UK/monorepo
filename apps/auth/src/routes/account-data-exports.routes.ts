import {
  ACCOUNT_DATA_EXPORTS_CURRENT_PATH,
  ACCOUNT_DATA_EXPORTS_DELETE_PATH,
  ACCOUNT_DATA_EXPORTS_DOWNLOAD_PATH,
  ACCOUNT_DATA_EXPORTS_PATH,
  ACCOUNT_REAUTH_REQUIRED,
  subjectExportDeleteRequestSchema,
  subjectExportDownloadRequestSchema,
} from "@auction/identity-contracts";
import { type Context, Hono } from "hono";
import {
  type SubjectExportService,
  SubjectExportStorageUnavailableError,
} from "../services/subject-export.service.js";
import { type AccountCallerDeps, authenticateAccountCaller } from "./account-caller.js";

export type AccountDataExportRouteDeps = Omit<AccountCallerDeps, "rateLimit"> & {
  exports: Pick<SubjectExportService, "current" | "request" | "download" | "deleteCopy">;
  /** Budget for reading the current request. */
  readRateLimit: AccountCallerDeps["rateLimit"];
  /** Tighter budget for requesting, downloading and deleting. */
  changeRateLimit: AccountCallerDeps["rateLimit"];
  onFailure?: (error: unknown) => void;
};

const MAX_USER_AGENT_LENGTH = 512;
const MAX_IP_LENGTH = 64;

/** A field LAX Account forwards from the person's own request; bounded, and null when absent. */
function forwarded(params: URLSearchParams, name: string, max: number): string | null {
  const value = params.get(name)?.trim();
  return value ? value.slice(0, max) : null;
}

/**
 * Lets LAX Account show a person's data download and act on it: ask for a copy, read the latest
 * request, get a one-time download link, and delete the copy.
 *
 * Authorisation is described on authenticateAccountCaller. Asking and downloading also carry
 * `sid` and need a recent sign-in; deleting needs a live one. LAX Account forwards the person's
 * browser and address as `user_agent` and `ip`, which are recorded and shown in the "a copy was
 * requested" email, because the call itself comes from LAX Account's server. "Already open" and
 * "too many requests" are answers, not errors, so they come back as 200 with the outcome.
 */
export function createAccountDataExportRoutes(deps: AccountDataExportRouteDeps) {
  const app = new Hono();
  const reads: AccountCallerDeps = { ...deps, rateLimit: deps.readRateLimit };
  const changes: AccountCallerDeps = { ...deps, rateLimit: deps.changeRateLimit };

  async function guarded(c: Context, run: () => Promise<Response>): Promise<Response> {
    try {
      return await run();
    } catch (error) {
      deps.onFailure?.(error);
      const storage = error instanceof SubjectExportStorageUnavailableError;
      return c.json({ error: storage ? "download_unavailable" : "temporarily_unavailable" }, 503);
    }
  }

  const reauth = (c: Context) => c.json({ error: ACCOUNT_REAUTH_REQUIRED }, 403);

  app.post(ACCOUNT_DATA_EXPORTS_CURRENT_PATH, async (c) => {
    const caller = await authenticateAccountCaller(c, reads);
    if (caller instanceof Response) return caller;
    return guarded(c, async () => c.json({ export: await deps.exports.current(caller.subjectId) }));
  });

  app.post(ACCOUNT_DATA_EXPORTS_PATH, async (c) => {
    const caller = await authenticateAccountCaller(c, changes);
    if (caller instanceof Response) return caller;
    const sid = caller.params.get("sid");
    if (!sid) return c.json({ error: "invalid_request" }, 400);
    return guarded(c, async () => {
      const result = await deps.exports.request(caller.subjectId, {
        sessionId: sid,
        ipAddress: forwarded(caller.params, "ip", MAX_IP_LENGTH),
        userAgent: forwarded(caller.params, "user_agent", MAX_USER_AGENT_LENGTH),
      });
      return result.ok ? c.json(result.outcome) : reauth(c);
    });
  });

  app.post(ACCOUNT_DATA_EXPORTS_DOWNLOAD_PATH, async (c) => {
    const caller = await authenticateAccountCaller(c, changes);
    if (caller instanceof Response) return caller;
    const sid = caller.params.get("sid");
    const body = subjectExportDownloadRequestSchema.safeParse({ id: caller.params.get("id") });
    if (!sid || !body.success) return c.json({ error: "invalid_request" }, 400);
    return guarded(c, async () => {
      const result = await deps.exports.download(caller.subjectId, body.data.id, {
        sessionId: sid,
        ipAddress: forwarded(caller.params, "ip", MAX_IP_LENGTH),
        userAgent: forwarded(caller.params, "user_agent", MAX_USER_AGENT_LENGTH),
      });
      if (!result.ok) return reauth(c);
      switch (result.result.outcome) {
        case "signed":
          return c.json({ url: result.result.url, expiresAt: result.result.expiresAt });
        case "not_found":
          return c.json({ error: "not_found" }, 404);
        case "unavailable":
          return c.json({ error: "export_unavailable" }, 410);
      }
    });
  });

  app.post(ACCOUNT_DATA_EXPORTS_DELETE_PATH, async (c) => {
    const caller = await authenticateAccountCaller(c, changes);
    if (caller instanceof Response) return caller;
    const sid = caller.params.get("sid");
    const body = subjectExportDeleteRequestSchema.safeParse({ id: caller.params.get("id") });
    if (!sid || !body.success) return c.json({ error: "invalid_request" }, 400);
    return guarded(c, async () => {
      const result = await deps.exports.deleteCopy(caller.subjectId, body.data.id, sid);
      return result.ok ? c.json({ outcome: result.outcome }) : reauth(c);
    });
  });

  return app;
}
