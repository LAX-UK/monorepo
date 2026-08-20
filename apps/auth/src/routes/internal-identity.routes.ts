import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { type Context, Hono } from "hono";
import type { IIdentityLifecycleService } from "../services/identity-lifecycle.service.js";
import { IdentityLifecycleConflictError } from "../services/identity-lifecycle.service.js";
import {
  IdentityOperationError,
  type IdentityOperationsService,
} from "../services/identity-operations.service.js";

const MACHINE_TOKEN_TTL_SEC = 5 * 60;
const MACHINE_SCOPE = "identity.lifecycle";

type MachineTokenRedis = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ex: "EX", ttl: number): Promise<unknown>;
};

function tokenKey(token: string): string {
  return `identity:machine-token:${createHash("sha256").update(token).digest("hex")}`;
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function parseBasicCredentials(header: string | undefined): {
  clientId: string;
  clientSecret: string;
} | null {
  if (!header?.startsWith("Basic ")) return null;
  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 1) return null;
    return {
      clientId: decoded.slice(0, separator),
      clientSecret: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

export function createInternalIdentityRoutes(options: {
  lifecycle: IIdentityLifecycleService;
  operations: IdentityOperationsService;
  redis: MachineTokenRedis;
  machineClientId: string;
  machineClientSecret: string;
  allowMerge?: boolean;
  onOperation?: (operation: "disable" | "enable" | "merge", subjectId: string) => void;
}) {
  const app = new Hono();

  app.post("/oauth/token", async (c) => {
    const credentials = parseBasicCredentials(c.req.header("authorization"));
    const body = await c.req.parseBody();
    if (
      body.grant_type !== "client_credentials" ||
      body.scope !== MACHINE_SCOPE ||
      !credentials ||
      !safeEqual(credentials.clientId, options.machineClientId) ||
      !safeEqual(credentials.clientSecret, options.machineClientSecret)
    ) {
      c.header("Cache-Control", "no-store");
      return c.json({ error: "invalid_client" }, 401);
    }

    const token = randomBytes(32).toString("base64url");
    await options.redis.set(tokenKey(token), credentials.clientId, "EX", MACHINE_TOKEN_TTL_SEC);
    c.header("Cache-Control", "no-store");
    return c.json({
      access_token: token,
      token_type: "Bearer",
      expires_in: MACHINE_TOKEN_TTL_SEC,
      scope: MACHINE_SCOPE,
    });
  });

  app.use("/identity/*", async (c, next) => {
    const authorization = c.req.header("authorization");
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
    const clientId = token ? await options.redis.get(tokenKey(token)) : null;
    if (!clientId || !safeEqual(clientId, options.machineClientId)) {
      return c.json({ error: "unauthorized" }, 401);
    }
    await next();
  });

  app.post("/identity/subjects/:subjectId/disable", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { reason?: unknown };
    const reason = typeof body.reason === "string" ? body.reason.slice(0, 500) : undefined;
    const subjectId = c.req.param("subjectId");
    return runLifecycle(c, async () => {
      await options.lifecycle.disable(subjectId, reason);
      options.onOperation?.("disable", subjectId);
    });
  });

  app.post("/identity/subjects/:subjectId/enable", (c) => {
    const subjectId = c.req.param("subjectId");
    return runLifecycle(c, async () => {
      await options.lifecycle.enable(subjectId);
      options.onOperation?.("enable", subjectId);
    });
  });

  app.post("/identity/subjects/:subjectId/merge", async (c) => {
    if (!options.allowMerge) {
      return c.json({ error: "identity_merge_not_enabled" }, 503);
    }
    const body = (await c.req.json().catch(() => ({}))) as { canonicalSubjectId?: unknown };
    if (typeof body.canonicalSubjectId !== "string" || !body.canonicalSubjectId) {
      return c.json({ error: "canonicalSubjectId_required" }, 400);
    }
    const retiredSubjectId = c.req.param("subjectId");
    return runLifecycle(c, async () => {
      await options.lifecycle.merge(retiredSubjectId, body.canonicalSubjectId as string);
      options.onOperation?.("merge", retiredSubjectId);
    });
  });

  app.get("/identity/subjects/:subjectId", async (c) => {
    const subject = await options.operations.readSubject(c.req.param("subjectId"));
    return subject ? c.json({ subject }) : c.json({ error: "subject_not_found" }, 404);
  });

  app.get("/identity/subjects/:subjectId/security-status", async (c) => {
    const status = await options.operations.readSecurityStatus(c.req.param("subjectId"));
    return status ? c.json({ status }) : c.json({ error: "subject_not_found" }, 404);
  });

  app.post("/identity/subjects/lookup", async (c) => {
    const body = await readJson(c);
    if (typeof body.email !== "string" || !body.email) {
      return c.json({ error: "email_required" }, 400);
    }
    return c.json({ subject: await options.operations.findSubjectByEmail(body.email) });
  });

  app.get("/identity/subjects/:subjectId/credentials", async (c) =>
    c.json(await options.operations.credentialSummary(c.req.param("subjectId"))),
  );

  app.post("/identity/subjects/:subjectId/credentials/password", async (c) => {
    const body = await readJson(c);
    if (typeof body.password !== "string" || body.password.length < 1) {
      return c.json({ error: "password_required" }, 400);
    }
    return runIdentityOperation(c, async () => {
      await options.operations.setupPassword(
        c.req.param("subjectId"),
        body.password as string,
        typeof body.sessionToken === "string" ? body.sessionToken : undefined,
      );
      return { ok: true };
    });
  });

  app.post("/identity/subjects/:subjectId/credentials/change-password", async (c) => {
    const body = await readJson(c);
    if (
      typeof body.currentPassword !== "string" ||
      typeof body.newPassword !== "string" ||
      typeof body.sessionToken !== "string"
    ) {
      return c.json({ error: "passwords_and_session_token_required" }, 400);
    }
    return runIdentityOperation(c, async () => {
      await options.operations.changePassword(
        c.req.param("subjectId"),
        body.currentPassword as string,
        body.newPassword as string,
        body.sessionToken as string,
      );
      return { ok: true };
    });
  });

  app.post("/identity/subjects/:subjectId/step-up/status", async (c) => {
    const body = await readJson(c);
    if (typeof body.sessionToken !== "string" || !body.sessionToken) {
      return c.json({ error: "session_token_required" }, 400);
    }
    return runIdentityOperation(c, () =>
      options.operations.stepUpStatus(c.req.param("subjectId"), body.sessionToken as string),
    );
  });

  app.post("/identity/subjects/:subjectId/step-up/verify-password", async (c) => {
    const body = await readJson(c);
    if (
      typeof body.password !== "string" ||
      !body.password ||
      typeof body.sessionToken !== "string" ||
      !body.sessionToken
    ) {
      return c.json({ error: "password_and_session_token_required" }, 400);
    }
    return runIdentityOperation(c, async () => {
      await options.operations.verifyPasswordAndStamp(
        c.req.param("subjectId"),
        body.password as string,
        body.sessionToken as string,
      );
      return { ok: true };
    });
  });

  app.post("/identity/subjects/:subjectId/sessions/list", async (c) => {
    const body = await readJson(c);
    const sessions = await options.operations.listSessions(
      c.req.param("subjectId"),
      typeof body.currentSessionToken === "string" ? body.currentSessionToken : undefined,
    );
    return c.json({ sessions });
  });

  app.post("/identity/subjects/:subjectId/sessions/revoke", async (c) => {
    const body = await readJson(c);
    if (typeof body.sessionId !== "string" || !body.sessionId) {
      return c.json({ error: "session_id_required" }, 400);
    }
    return c.json({
      revoked: await options.operations.revokeSession(
        c.req.param("subjectId"),
        body.sessionId as string,
      ),
    });
  });

  app.post("/identity/subjects/:subjectId/sessions/revoke-all", async (c) => {
    const body = await readJson(c);
    return c.json({
      revoked: await options.operations.revokeAllSessions(
        c.req.param("subjectId"),
        typeof body.exceptSessionToken === "string" ? body.exceptSessionToken : undefined,
      ),
    });
  });

  app.post("/identity/subjects/:subjectId/email-change/start", async (c) => {
    const body = await readJson(c);
    if (typeof body.newEmail !== "string" || typeof body.expiresAt !== "string") {
      return c.json({ error: "new_email_and_expiry_required" }, 400);
    }
    const expiresAt = new Date(body.expiresAt);
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      return c.json({ error: "invalid_expiry" }, 400);
    }
    return runIdentityOperation(c, async () => {
      await options.operations.startEmailChange(
        c.req.param("subjectId"),
        body.newEmail as string,
        expiresAt,
      );
      return { ok: true };
    });
  });

  app.get("/identity/subjects/:subjectId/email-change", async (c) =>
    c.json({
      pendingNewEmail: await options.operations.pendingEmailChange(c.req.param("subjectId")),
    }),
  );

  app.post("/identity/subjects/:subjectId/email-change/cancel", (c) =>
    runIdentityOperation(c, async () => {
      await options.operations.cancelEmailChange(c.req.param("subjectId"));
      return { ok: true };
    }),
  );

  app.post("/identity/subjects/:subjectId/email-change/confirm", async (c) => {
    const body = await readJson(c);
    if (
      typeof body.oldEmail !== "string" ||
      typeof body.newEmail !== "string" ||
      (body.confirmFor !== "old" && body.confirmFor !== "new")
    ) {
      return c.json({ error: "invalid_email_change_confirmation" }, 400);
    }
    return runIdentityOperation(c, async () => ({
      completed: await options.operations.confirmEmailChange({
        subjectId: c.req.param("subjectId"),
        oldEmail: body.oldEmail as string,
        newEmail: body.newEmail as string,
        confirmFor: body.confirmFor as "old" | "new",
      }),
    }));
  });

  app.delete("/identity/subjects/:subjectId/orphan", (c) =>
    runIdentityOperation(c, async () => ({
      deleted: await options.operations.deleteOrphanSubject(c.req.param("subjectId")),
    })),
  );

  app.patch("/identity/subjects/:subjectId/profile", async (c) => {
    const body = await readJson(c);
    const patch = {
      ...(typeof body.name === "string" ? { name: body.name } : {}),
      ...(typeof body.image === "string" || body.image === null
        ? { image: body.image as string | null }
        : {}),
    };
    if (!("name" in patch) && !("image" in patch)) {
      return c.json({ error: "profile_patch_required" }, 400);
    }
    return runIdentityOperation(c, async () => {
      await options.operations.updateSubjectProfile(c.req.param("subjectId"), patch);
      return { ok: true };
    });
  });

  app.post("/identity/subjects/:subjectId/deletion-request", (c) =>
    runIdentityOperation(c, async () => {
      await options.operations.markDeletionRequested(c.req.param("subjectId"));
      return { ok: true };
    }),
  );

  app.delete("/identity/subjects/:subjectId/deletion-request", (c) =>
    runIdentityOperation(c, async () => {
      await options.operations.cancelDeletionRequested(c.req.param("subjectId"));
      return { ok: true };
    }),
  );

  app.post("/identity/maintenance/purge-expired-verifications", async (c) =>
    c.json({ deleted: await options.operations.purgeExpiredVerifications() }),
  );

  return app;
}

async function readJson(c: Context): Promise<Record<string, unknown>> {
  return (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
}

async function runIdentityOperation(c: Context, action: () => Promise<unknown>) {
  try {
    return c.json(await action());
  } catch (error) {
    if (error instanceof IdentityOperationError) {
      const status =
        error.code === "subject_not_found"
          ? 404
          : error.code === "product_usage_unavailable"
            ? 503
            : error.code === "invalid_password" || error.code === "no_session"
              ? 401
              : error.code === "already_set" ||
                  error.code === "email_taken" ||
                  error.code === "not_orphan" ||
                  error.code === "stale_flow"
                ? 409
                : error.code === "expired"
                  ? 410
                  : 400;
      return c.json({ error: error.code }, status);
    }
    throw error;
  }
}

async function runLifecycle(c: Context, action: () => Promise<void>) {
  try {
    await action();
    return c.json({ ok: true });
  } catch (error) {
    if (error instanceof IdentityLifecycleConflictError) {
      const status = error.code === "subject_not_found" ? 404 : 409;
      return c.json({ error: error.code }, status);
    }
    throw error;
  }
}
