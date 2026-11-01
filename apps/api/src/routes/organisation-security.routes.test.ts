import { Hono } from "hono";
import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import type { ContainerOrganisationSecurityRoutesSlice } from "../container.js";
import type { LegalEntityContext } from "../middleware/require-legal-entity-context.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createOrganisationSecurityRoutes } from "./organisation-security.js";

const ENTITY = "00000000-0000-4000-8000-000000000001";

function mount(remind: ReturnType<typeof vi.fn>) {
  const context = {
    legalEntityId: ENTITY,
    userId: "owner-1",
    role: "owner",
    isPrimaryAdmin: true,
  } as LegalEntityContext;
  const container = {
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    requireLegalEntityContext: async (
      c: { set: (key: string, value: LegalEntityContext) => void },
      next: () => Promise<void>,
    ) => {
      c.set("legalEntityContext", context);
      await next();
    },
    organisationSecurity: { twoStepReminders: { remind } },
  } as unknown as ContainerOrganisationSecurityRoutesSlice;
  const authenticator: IAuthenticator = {
    getSessionUser: vi
      .fn()
      .mockResolvedValue({ id: "owner-1", role: "client", scopes: ["bid.read", "bid.write"] }),
  };
  const app = new Hono();
  app.route("/legal-entities", createOrganisationSecurityRoutes(container, authenticator));
  return app;
}

describe("organisation security routes", () => {
  it("sends the reminder for the acting member", async () => {
    const remind = vi.fn(async () => ok({ reminded: 2 }));
    const res = await mount(remind).request("/legal-entities/two-step-reminders", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { reminded: 2 } });
    expect(remind).toHaveBeenCalledWith({
      userId: "owner-1",
      legalEntityId: ENTITY,
      role: "owner",
      isImpersonation: undefined,
    });
  });

  it("answers 429 with the reason when one was sent today", async () => {
    const remind = vi.fn(async () =>
      err({ code: "sent_recently" as const, status: 429 as const, message: "Tomorrow." }),
    );
    const res = await mount(remind).request("/legal-entities/two-step-reminders", {
      method: "POST",
    });
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "sent_recently", message: "Tomorrow." });
  });
});
