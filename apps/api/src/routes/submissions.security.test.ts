import type { LegalEntityMemberRole } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { passThroughAccountOnboarding } from "../testing/pass-through-account-onboarding.middleware.js";
import { stubSubmissionRouteServices } from "../testing/stub-submission-route-services.js";
import { createSubmissionRoutes } from "./submissions.js";

const entityId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const submissionId = "33333333-3333-4333-8333-333333333333";
const categoryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function mockContainer(
  overrides: Partial<ReturnType<typeof stubSubmissionRouteServices>> = {},
  role: LegalEntityMemberRole = "owner",
  isImpersonation = false,
) {
  return {
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    requireSubmissionsLegalEntityContext: vi.fn((c, next) => {
      c.set("legalEntityContext", { legalEntityId: entityId, role, isImpersonation });
      return next();
    }),
    submissionRoutes: stubSubmissionRouteServices(overrides),
  } as unknown as Container;
}

describe("submissions API contract", () => {
  it("GET /submissions/mine returns stable top-level keys", async () => {
    const app = new Hono();
    const listMine = vi.fn().mockResolvedValue({
      status: 200,
      body: { data: [{ id: "sub-1", title: "T", images: [] }], total: 1 },
    });
    const container = mockContainer({ sellerHttp: { listMine } as never });
    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({ id: "u1", role: "client", scopes: ["bid.read"] }),
    };
    app.route(
      "/submissions",
      createSubmissionRoutes(container, authenticator, passThroughAccountOnboarding),
    );
    const res = await app.request(
      `http://t/submissions/mine?${new URLSearchParams({ limit: "10", offset: "0" })}`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown[]; total: number };
    expect(Object.keys(body).sort()).toEqual(["data", "total"]);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("GET /submissions/:id returns stable top-level keys", async () => {
    const app = new Hono();
    const getById = vi.fn().mockResolvedValue({
      status: 200,
      body: { data: { id: submissionId, title: "T", images: [] } },
    });
    const container = mockContainer({ sellerHttp: { getById } as never });
    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({ id: "u1", role: "client", scopes: ["bid.read"] }),
    };
    app.route(
      "/submissions",
      createSubmissionRoutes(container, authenticator, passThroughAccountOnboarding),
    );
    const res = await app.request(`http://t/submissions/${submissionId}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown };
    expect(Object.keys(body).sort()).toEqual(["data"]);
  });

  it("PATCH /submissions/:id maps bad_request to 400 with error and details", async () => {
    const app = new Hono();
    const patch = vi.fn().mockResolvedValue({
      status: 400,
      body: {
        error: "Invalid body",
        details: { fieldErrors: { title: ["Expected string"] }, formErrors: [] },
      },
    });
    const container = mockContainer({ sellerHttp: { patch } as never });
    const authenticator: IAuthenticator = {
      getSessionUser: vi
        .fn()
        .mockResolvedValue({ id: "u1", role: "client", scopes: ["bid.write"] }),
    };
    app.route(
      "/submissions",
      createSubmissionRoutes(container, authenticator, passThroughAccountOnboarding),
    );
    const res = await app.request(`http://t/submissions/${submissionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: true }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; details: unknown };
    expect(body.error).toBe("Invalid body");
    expect(body).toHaveProperty("details");
  });

  it("POST /submissions returns 201 with stable top-level keys", async () => {
    const app = new Hono();
    const created = { id: submissionId, title: "New", images: [] };
    const createDraft = vi.fn().mockResolvedValue({ status: 201, body: { data: created } });
    const container = mockContainer({ sellerHttp: { createDraft } as never });
    const authenticator: IAuthenticator = {
      getSessionUser: vi
        .fn()
        .mockResolvedValue({ id: "u1", role: "client", scopes: ["bid.write"] }),
    };
    app.route(
      "/submissions",
      createSubmissionRoutes(container, authenticator, passThroughAccountOnboarding),
    );
    const res = await app.request("http://t/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New submission", categoryIds: [categoryId] }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: unknown };
    expect(Object.keys(body).sort()).toEqual(["data"]);
    expect(body.data).toEqual(created);
    expect(createDraft).toHaveBeenCalled();
  });

  describe("who may start a submission for an organisation", () => {
    async function post(role: LegalEntityMemberRole) {
      const createDraft = vi
        .fn()
        .mockResolvedValue({ status: 201, body: { data: { id: submissionId } } });
      const container = mockContainer({ sellerHttp: { createDraft } as never }, role);
      const authenticator: IAuthenticator = {
        getSessionUser: vi
          .fn()
          .mockResolvedValue({ id: "u1", role: "client", scopes: ["bid.write"] }),
      };
      const app = new Hono();
      app.route(
        "/submissions",
        createSubmissionRoutes(container, authenticator, passThroughAccountOnboarding),
      );
      const res = await app.request("http://t/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New submission", categoryIds: [categoryId] }),
      });
      return { res, createDraft };
    }

    it.each(["owner", "admin", "consignor"] as const)("lets %s create one", async (role) => {
      const { res, createDraft } = await post(role);
      expect(res.status).toBe(201);
      expect(createDraft).toHaveBeenCalled();
    });

    it.each(["finance", "viewer", "buyer_agent"] as const)(
      "refuses %s with 403 and creates nothing",
      async (role) => {
        const { res, createDraft } = await post(role);
        expect(res.status).toBe(403);
        expect(await res.json()).toMatchObject({ error: "insufficient_entity_role" });
        expect(createDraft).not.toHaveBeenCalled();
      },
    );
  });

  describe("who may change a submission, per route", () => {
    const documentId = "44444444-4444-4444-8444-444444444444";
    const uploadObjectId = "55555555-5555-4555-8555-555555555555";
    const ok = { status: 200, body: { data: { id: submissionId } } };
    const routes = [
      {
        name: "PATCH /:id",
        handler: "patch",
        service: "sellerHttp",
        request: { method: "PATCH", path: `/${submissionId}`, body: { title: "Edited" } },
      },
      {
        name: "POST /:id/submit",
        handler: "submitForReview",
        service: "sellerHttp",
        request: { method: "POST", path: `/${submissionId}/submit` },
      },
      {
        name: "POST /:id/documents",
        handler: "attachForViewer",
        service: "documentHttp",
        request: {
          method: "POST",
          path: `/${submissionId}/documents`,
          body: { kind: "provenance", uploadObjectId },
        },
      },
      {
        name: "DELETE /:id/documents/:documentId",
        handler: "removeForViewer",
        service: "documentHttp",
        request: { method: "DELETE", path: `/${submissionId}/documents/${documentId}` },
      },
      {
        name: "POST /:id/withdraw",
        handler: "withdraw",
        service: "sellerHttp",
        request: { method: "POST", path: `/${submissionId}/withdraw` },
      },
    ] as const;

    async function call(
      route: (typeof routes)[number],
      role: LegalEntityMemberRole,
      isImpersonation = false,
    ) {
      const handler = vi.fn().mockResolvedValue(ok);
      const container = mockContainer(
        { [route.service]: { [route.handler]: handler } } as never,
        role,
        isImpersonation,
      );
      const authenticator: IAuthenticator = {
        getSessionUser: vi
          .fn()
          .mockResolvedValue({ id: "u1", role: "client", scopes: ["bid.write"] }),
      };
      const app = new Hono();
      app.route(
        "/submissions",
        createSubmissionRoutes(container, authenticator, passThroughAccountOnboarding),
      );
      const body = "body" in route.request ? route.request.body : undefined;
      const res = await app.request(`http://t/submissions${route.request.path}`, {
        method: route.request.method,
        headers: { "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { res, handler };
    }

    /** Who passes each route's gate; which submission they may change is the service's call. */
    const PASSES: Record<(typeof routes)[number]["name"], LegalEntityMemberRole[]> = {
      "PATCH /:id": ["owner", "admin", "consignor"],
      "POST /:id/submit": ["owner", "admin", "consignor"],
      "POST /:id/documents": ["owner", "admin", "consignor"],
      "DELETE /:id/documents/:documentId": ["owner", "admin", "consignor"],
      "POST /:id/withdraw": ["owner", "admin"],
    };
    const roles = ["owner", "admin", "consignor", "finance", "viewer", "buyer_agent"] as const;

    it.each(routes.flatMap((route) => roles.map((role) => [route.name, role, route] as const)))(
      "%s as %s",
      async (_name, role, route) => {
        const { res, handler } = await call(route, role);
        if (PASSES[route.name].includes(role)) {
          expect(res.status).toBe(200);
          expect(handler).toHaveBeenCalled();
          return;
        }
        expect(res.status).toBe(403);
        const body = (await res.json()) as { error: string; message: string };
        expect(body.error).toBe("insufficient_entity_role");
        expect(body.message).toMatch(/^(Your role|Only an owner)/);
        expect(handler).not.toHaveBeenCalled();
      },
    );

    it.each(routes.map((route) => [route.name, route] as const))(
      "%s is read-only for support staff viewing as the client",
      async (_name, route) => {
        const { res, handler } = await call(route, "admin", true);
        expect(res.status).toBe(403);
        expect(((await res.json()) as { message: string }).message).toBe(
          "You're viewing this organisation as LAX support, so changes are turned off.",
        );
        expect(handler).not.toHaveBeenCalled();
      },
    );
  });
});
