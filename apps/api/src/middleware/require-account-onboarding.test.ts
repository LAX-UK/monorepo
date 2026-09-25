import type { UserRole } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createRequireAccountOnboarding } from "./require-account-onboarding.js";

type Vars = { userId?: string; userRole?: UserRole };

describe("createRequireAccountOnboarding", () => {
  it("allows staff without checking the gate", async () => {
    const isComplete = vi.fn(async () => false);
    const app = new Hono<{ Variables: Vars }>();
    app.use("*", async (c, next) => {
      c.set("userId", "staff-1");
      c.set("userRole", "staff");
      await next();
    });
    app.post("/", createRequireAccountOnboarding({ isComplete }), (c) => c.json({ ok: true }));

    const res = await app.request("/", { method: "POST" });
    expect(res.status).toBe(200);
    expect(isComplete).not.toHaveBeenCalled();
  });

  it("returns 403 when onboarding is incomplete", async () => {
    const isComplete = vi.fn(async () => false);
    const app = new Hono<{ Variables: Vars }>();
    app.use("*", async (c, next) => {
      c.set("userId", "client-1");
      c.set("userRole", "client");
      await next();
    });
    app.post("/", createRequireAccountOnboarding({ isComplete }), (c) => c.json({ ok: true }));

    const res = await app.request("/", { method: "POST" });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("onboarding_required");
  });
});
