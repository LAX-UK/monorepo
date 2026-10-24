import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { IdentityIssuerClientError } from "../infrastructure/http-identity-issuer.client.js";
import { createRequireRecentStaffAuth } from "./require-recent-staff-auth.js";

type Vars = { userId?: string; identitySessionId?: string };

function setup(options: {
  userId?: string | undefined;
  sessionId?: string | undefined;
  isRecent: ReturnType<typeof vi.fn>;
}) {
  const handler = vi.fn((c) => c.json({ ok: true }));
  const app = new Hono<{ Variables: Vars }>();
  app.use("*", async (c, next) => {
    if (options.userId) c.set("userId", options.userId);
    if (options.sessionId) c.set("identitySessionId", options.sessionId);
    await next();
  });
  app.post("/act", createRequireRecentStaffAuth({ isRecent: options.isRecent }), handler);
  return { app, handler };
}

const post = (app: Hono<{ Variables: Vars }>) => app.request("/act", { method: "POST" });

describe("createRequireRecentStaffAuth", () => {
  it("lets a recent sign-in through and asks about the caller's own session", async () => {
    const isRecent = vi.fn().mockResolvedValue(true);
    const { app, handler } = setup({ userId: "staff-1", sessionId: "sid-1", isRecent });

    const res = await post(app);

    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
    expect(isRecent).toHaveBeenCalledWith({ subjectId: "staff-1", sessionId: "sid-1" });
  });

  it("answers 403 step_up_required when the sign-in is too old", async () => {
    const isRecent = vi.fn().mockResolvedValue(false);
    const { app, handler } = setup({ userId: "staff-1", sessionId: "sid-1", isRecent });

    const res = await post(app);

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: "Recent sign-in required",
      code: "step_up_required",
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("answers 403 step_up_required when the token carries no session id", async () => {
    const isRecent = vi.fn();
    const { app, handler } = setup({ userId: "staff-1", isRecent });

    const res = await post(app);

    expect(res.status).toBe(403);
    expect(((await res.json()) as { code: string }).code).toBe("step_up_required");
    expect(isRecent).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it("answers 401 when nobody is signed in", async () => {
    const { app } = setup({ isRecent: vi.fn() });

    const res = await post(app);

    expect(res.status).toBe(401);
  });

  it("answers 503 when Identity cannot be reached, never a free pass", async () => {
    const isRecent = vi
      .fn()
      .mockRejectedValue(new IdentityIssuerClientError("timeout", "identity timed out"));
    const { app, handler } = setup({ userId: "staff-1", sessionId: "sid-1", isRecent });

    const res = await post(app);

    expect(res.status).toBe(503);
    expect(((await res.json()) as { code: string }).code).toBe("identity_unavailable");
    expect(handler).not.toHaveBeenCalled();
  });

  it("does not swallow unexpected errors", async () => {
    const isRecent = vi.fn().mockRejectedValue(new Error("boom"));
    const { app, handler } = setup({ userId: "staff-1", sessionId: "sid-1", isRecent });

    const res = await post(app);

    expect(res.status).toBe(500);
    expect(handler).not.toHaveBeenCalled();
  });
});
