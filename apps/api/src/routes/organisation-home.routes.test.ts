import type { LegalEntityMemberRole } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { ContainerOrganisationHomeRoutesSlice } from "../container.js";
import type { LegalEntityContext } from "../middleware/require-legal-entity-context.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createOrganisationHomeRoutes } from "./organisation-home.js";

const ENTITY = "00000000-0000-4000-8000-000000000001";

function mount(role: LegalEntityMemberRole, isImpersonation?: boolean) {
  const context: LegalEntityContext = {
    legalEntityId: ENTITY,
    userId: "member-1",
    role,
    isPrimaryAdmin: role === "owner",
    ...(isImpersonation ? { isImpersonation } : {}),
  } as LegalEntityContext;
  const figures = vi.fn(async () => ({
    payoutsDue: {
      payouts: 1,
      totals: [{ currency: "GBP", amount: "900.00" }],
      nextDate: new Date("2026-11-03T00:00:00Z"),
    },
  }));
  const container = {
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    requireLegalEntityContext: async (
      c: { set: (key: string, value: LegalEntityContext) => void },
      next: () => Promise<void>,
    ) => {
      c.set("legalEntityContext", context);
      await next();
    },
    organisationHome: { dashboard: { figures } },
  } as unknown as ContainerOrganisationHomeRoutesSlice;
  const authenticator: IAuthenticator = {
    getSessionUser: vi
      .fn()
      .mockResolvedValue({ id: "member-1", role: "client", scopes: ["bid.read", "bid.write"] }),
  };
  const app = new Hono();
  app.route("/legal-entities", createOrganisationHomeRoutes(container, authenticator));
  return { app, figures };
}

describe("organisation home routes", () => {
  it("returns the member's figures for the acting organisation, dates as ISO strings", async () => {
    const { app, figures } = mount("finance");
    const res = await app.request("/legal-entities/home/dashboard");
    expect(res.status).toBe(200);
    expect(figures).toHaveBeenCalledWith({
      userId: "member-1",
      legalEntityId: ENTITY,
      role: "finance",
      isImpersonation: undefined,
    });
    expect(await res.json()).toEqual({
      data: {
        payoutsDue: {
          payouts: 1,
          totals: [{ currency: "GBP", amount: "900.00" }],
          nextDate: "2026-11-03T00:00:00.000Z",
        },
      },
    });
  });

  it("passes an impersonating admin through as read-only", async () => {
    const { app, figures } = mount("owner", true);
    await app.request("/legal-entities/home/dashboard");
    expect(figures).toHaveBeenCalledWith(expect.objectContaining({ isImpersonation: true }));
  });
});
