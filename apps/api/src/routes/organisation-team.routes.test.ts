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

  it("reads contact details for the acting organisation", async () => {
    const view = vi.fn(async () =>
      ok({ email: null, phone: null, website: null, updatedAt: null, canEdit: false }),
    );
    const res = await mount({ contactDetails: { view } }).request(
      "/legal-entities/contact-details",
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ data: { canEdit: false } });
    expect(view).toHaveBeenCalledWith(actor);
  });

  it("updates contact details from a validated, normalised body", async () => {
    const update = vi.fn(async () => ok({}));
    const res = await mount({ contactDetails: { update } }).request(
      "/legal-entities/contact-details",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "Hello@X.example", phone: "", website: "x.example" }),
      },
    );
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(actor, {
      email: "hello@x.example",
      phone: null,
      website: "https://x.example",
    });
  });

  it("refuses a bad contact body before the service, and passes a refusal through", async () => {
    const update = vi.fn(async () => err(FORBIDDEN));
    const app = mount({ contactDetails: { update } });
    const bad = await app.request("/legal-entities/contact-details", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: null, phone: "call us", website: null }),
    });
    expect(bad.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
    const refused = await app.request("/legal-entities/contact-details", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: null, phone: null, website: null }),
    });
    expect(refused.status).toBe(403);
  });

  it("lists statements", async () => {
    const list = vi.fn(async () => ok([{ payoutId: "p1" }]));
    const res = await mount({ statements: { list } }).request("/legal-entities/statements");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: [{ payoutId: "p1" }] });
    expect(list).toHaveBeenCalledWith(actor);
  });

  it("reads the payout account summary without caching it", async () => {
    const view = vi.fn(async () => ok({ state: "not_set_up", account: null }));
    const res = await mount({ payoutAccount: { view } }).request("/legal-entities/payout-account");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(view).toHaveBeenCalledWith(actor);
  });

  it("answers 403 when the role may not see members' last activity", async () => {
    const list = vi.fn(async () => err(FORBIDDEN));
    const res = await mount({ memberLastActive: { list } }).request(
      "/legal-entities/members/last-active",
    );
    expect(res.status).toBe(403);
    expect(list).toHaveBeenCalledWith(actor);
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
