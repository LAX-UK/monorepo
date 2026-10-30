import { Hono } from "hono";
import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import type { ContainerOrganisationTeamRoutesSlice } from "../container.js";
import type { LegalEntityContext } from "../middleware/require-legal-entity-context.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createOrganisationTeamRoutes } from "./organisation-team.js";

const ENTITY = "00000000-0000-4000-8000-000000000001";
const FORBIDDEN = { code: "forbidden" as const, status: 403 as const, message: "No" };

function mount(services: Record<string, unknown>) {
  const context = {
    legalEntityId: ENTITY,
    userId: "member-1",
    role: "finance",
    isPrimaryAdmin: false,
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
    organisationTeam: services,
  } as unknown as ContainerOrganisationTeamRoutesSlice;
  const authenticator: IAuthenticator = {
    getSessionUser: vi
      .fn()
      .mockResolvedValue({ id: "member-1", role: "client", scopes: ["bid.read", "bid.write"] }),
  };
  const app = new Hono();
  app.route("/legal-entities", createOrganisationTeamRoutes(container, authenticator));
  return app;
}

const actor = {
  userId: "member-1",
  legalEntityId: ENTITY,
  role: "finance",
  isImpersonation: undefined,
};

describe("organisation team routes", () => {
  it("updates invoice details from a validated body", async () => {
    const update = vi.fn(async () =>
      ok({ billingEmail: "a@b.example", address: null, poReference: null, updatedAt: null }),
    );
    const res = await mount({ invoiceDetails: { update } }).request(
      "/legal-entities/invoice-details",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingEmail: "A@B.example", address: null, poReference: "" }),
      },
    );
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(actor, {
      billingEmail: "a@b.example",
      address: null,
      poReference: null,
    });
  });

  it("refuses a bad body before the service", async () => {
    const update = vi.fn();
    const res = await mount({ invoiceDetails: { update } }).request(
      "/legal-entities/invoice-details",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingEmail: "nope", address: null, poReference: null }),
      },
    );
    expect(res.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("answers 403 when the role may not read activity", async () => {
    const list = vi.fn(async () => err(FORBIDDEN));
    const res = await mount({ activity: { list } }).request("/legal-entities/activity");
    expect(res.status).toBe(403);
    expect(list).toHaveBeenCalledWith(actor, { limit: 50 });
  });

  it("exports activity as a CSV download with the list's filters", async () => {
    const exportCsv = vi.fn(async () => ok({ csv: "﻿Date (UTC)\n", truncated: false }));
    const res = await mount({ activity: { exportCsv } }).request(
      "/legal-entities/activity/export?group=members&before=40",
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toMatch(
      /^attachment; filename="organisation-activity-export-/,
    );
    expect(exportCsv).toHaveBeenCalledWith(actor, { group: ["members"] });
  });
});
