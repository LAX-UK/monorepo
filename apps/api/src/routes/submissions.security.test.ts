import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { stubSubmissionRouteServices } from "../testing/stub-submission-route-services.js";
import { createSubmissionRoutes } from "./submissions.js";

const entityId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const submissionId = "33333333-3333-4333-8333-333333333333";
const categoryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function mockContainer(overrides: Partial<ReturnType<typeof stubSubmissionRouteServices>> = {}) {
  return {
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    requireSubmissionsLegalEntityContext: vi.fn((c, next) => {
      c.set("legalEntityContext", { legalEntityId: entityId });
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
    app.route("/submissions", createSubmissionRoutes(container, authenticator));
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
    app.route("/submissions", createSubmissionRoutes(container, authenticator));
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
    app.route("/submissions", createSubmissionRoutes(container, authenticator));
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
    app.route("/submissions", createSubmissionRoutes(container, authenticator));
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
});
