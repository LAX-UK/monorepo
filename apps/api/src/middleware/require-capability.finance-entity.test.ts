import { legalEntityMemberRoles } from "@auction/types";
import type { LegalEntityMemberRole } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { requireFinanceEntityWrite } from "./require-capability.js";
import type { LegalEntityContext } from "./require-legal-entity-context.js";

const FINANCE_WRITERS: LegalEntityMemberRole[] = ["owner", "admin", "finance"];

function appWith(context: LegalEntityContext | undefined, userRole = "client") {
  const app = new Hono<{
    Variables: { userRole?: string; legalEntityContext?: LegalEntityContext };
  }>();
  app.use("*", async (c, next) => {
    c.set("userRole", userRole);
    if (context) c.set("legalEntityContext", context);
    await next();
  });
  app.post("/pay", requireFinanceEntityWrite, (c) => c.json({ ok: true }));
  return app;
}

function context(role: LegalEntityMemberRole, isImpersonation = false): LegalEntityContext {
  return {
    legalEntityId: "entity-1",
    userId: "user-1",
    role,
    isPrimaryAdmin: false,
    ...(isImpersonation ? { isImpersonation: true } : {}),
  };
}

describe("requireFinanceEntityWrite", () => {
  it.each(legalEntityMemberRoles)("decides %s by the capability matrix", async (role) => {
    const res = await appWith(context(role)).request("/pay", { method: "POST" });

    expect(res.status).toBe(FINANCE_WRITERS.includes(role) ? 200 : 403);
  });

  it("refuses a request with no acting organisation", async () => {
    const res = await appWith(undefined).request("/pay", { method: "POST" });

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "insufficient_entity_finance_role" });
  });

  it("keeps an impersonating admin from moving the organisation's money", async () => {
    const res = await appWith(context("admin", true)).request("/pay", { method: "POST" });

    expect(res.status).toBe(403);
  });
});
