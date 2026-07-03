import { Hono } from "hono";
import { ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createSubmissionRoutes } from "./submissions.js";

const entityId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const submissionId = "33333333-3333-4333-8333-333333333333";
const categoryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("submissions API contract", () => {
  it("GET /submissions/mine returns stable top-level keys", async () => {
    const app = new Hono();
    const listSubmissionsForSellerApi = vi.fn().mockResolvedValue({
      data: [{ id: "sub-1", title: "T", images: [] }],
    });
    const container = {
      userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
      requireSubmissionsLegalEntityContext: vi.fn((c, next) => {
        c.set("legalEntityContext", { legalEntityId: entityId });
        return next();
      }),
      itemSubmissionSellerApi: { listSubmissionsForSellerApi },
      mediaUrlResolver: { resolveMany: vi.fn().mockResolvedValue([]) },
    } as unknown as Container;
    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({ id: "u1", role: "client" }),
    };
    app.route("/submissions", createSubmissionRoutes(container, authenticator));
    const res = await app.request(
      `http://t/submissions/mine?${new URLSearchParams({ limit: "10", offset: "0" })}`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown[] };
    expect(Object.keys(body).sort()).toEqual(["data"]);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("GET /submissions/:id returns stable top-level keys", async () => {
    const app = new Hono();
    const getSubmissionForViewerApi = vi
      .fn()
      .mockResolvedValue(ok({ id: submissionId, title: "T", images: [] }));
    const container = {
      userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
      requireSubmissionsLegalEntityContext: vi.fn((c, next) => {
        c.set("legalEntityContext", { legalEntityId: entityId });
        return next();
      }),
      itemSubmissionSellerApi: { getSubmissionForViewerApi },
      mediaUrlResolver: { resolveMany: vi.fn().mockResolvedValue([]) },
    } as unknown as Container;
    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({ id: "u1", role: "client" }),
    };
    app.route("/submissions", createSubmissionRoutes(container, authenticator));
    const res = await app.request(`http://t/submissions/${submissionId}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown };
    expect(Object.keys(body).sort()).toEqual(["data"]);
  });

  it("PATCH /submissions/:id maps bad_request to 400 with error and details", async () => {
    const app = new Hono();
    const patchSubmissionFromRequestBody = vi.fn().mockResolvedValue({
      kind: "bad_request" as const,
      details: { fieldErrors: { title: ["Expected string"] }, formErrors: [] },
    });
    const container = {
      userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
      requireSubmissionsLegalEntityContext: vi.fn((c, next) => {
        c.set("legalEntityContext", { legalEntityId: entityId });
        return next();
      }),
      itemSubmissionSellerApi: { patchSubmissionFromRequestBody },
      mediaUrlResolver: { resolveMany: vi.fn().mockResolvedValue([]) },
    } as unknown as Container;
    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({ id: "u1", role: "client" }),
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
    expect(body.details).toEqual({
      fieldErrors: { title: ["Expected string"] },
      formErrors: [],
    });
  });

  it("POST /submissions returns 201 with stable top-level keys", async () => {
    const app = new Hono();
    const created = { id: submissionId, title: "New", images: [] };
    const createDraftForSellerApi = vi.fn().mockResolvedValue(ok(created));
    const container = {
      userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
      requireSubmissionsLegalEntityContext: vi.fn((c, next) => {
        c.set("legalEntityContext", { legalEntityId: entityId });
        return next();
      }),
      itemSubmissionSellerApi: { createDraftForSellerApi },
      mediaUrlResolver: { resolveMany: vi.fn().mockResolvedValue([]) },
    } as unknown as Container;
    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({ id: "u1", role: "client" }),
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
    expect(createDraftForSellerApi).toHaveBeenCalled();
  });
});
