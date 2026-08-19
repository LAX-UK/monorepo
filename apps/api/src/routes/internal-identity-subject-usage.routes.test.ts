import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createInternalIdentitySubjectUsageRoutes } from "./internal-identity-subject-usage.routes.js";

const credentials = {
  IDENTITY_MACHINE_CLIENT_ID: "auth-service",
  IDENTITY_MACHINE_CLIENT_SECRET: "identity-machine-secret-at-least-32-characters",
};

function authHeaders() {
  return {
    "x-identity-client-id": credentials.IDENTITY_MACHINE_CLIENT_ID,
    "x-identity-client-secret": credentials.IDENTITY_MACHINE_CLIENT_SECRET,
  };
}

function createApp(
  getSubjectUsage = vi.fn().mockResolvedValue({
    hasProductProfile: true,
    hasExternalLink: false,
  }),
) {
  const app = new Hono().route(
    "/internal/identity",
    createInternalIdentitySubjectUsageRoutes(
      { subjectUsageReader: { getSubjectUsage } },
      credentials,
    ),
  );
  return { app, getSubjectUsage };
}

describe("internal Identity subject usage routes", () => {
  it("requires configured, matching machine credentials", async () => {
    const unconfigured = new Hono().route(
      "/internal/identity",
      createInternalIdentitySubjectUsageRoutes(
        { subjectUsageReader: { getSubjectUsage: vi.fn() } },
        {
          IDENTITY_MACHINE_CLIENT_ID: undefined,
          IDENTITY_MACHINE_CLIENT_SECRET: undefined,
        },
      ),
    );
    const unavailable = await unconfigured.request("/internal/identity/subject-usage/subject-1");
    expect(unavailable.status).toBe(503);

    const { app, getSubjectUsage } = createApp();
    const unauthorized = await app.request("/internal/identity/subject-usage/subject-1", {
      headers: { ...authHeaders(), "x-identity-client-id": "wrong" },
    });
    expect(unauthorized.status).toBe(401);
    expect(getSubjectUsage).not.toHaveBeenCalled();
  });

  it("returns both product-usage flags in one response", async () => {
    const { app, getSubjectUsage } = createApp();
    const response = await app.request("/internal/identity/subject-usage/subject-1", {
      headers: authHeaders(),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { hasProductProfile: true, hasExternalLink: false },
    });
    expect(getSubjectUsage).toHaveBeenCalledWith("subject-1");
  });

  it("fails closed when the product query is unavailable", async () => {
    const { app } = createApp(vi.fn().mockRejectedValue(new Error("database unavailable")));
    const response = await app.request("/internal/identity/subject-usage/subject-1", {
      headers: authHeaders(),
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "subject_usage_unavailable" });
  });
});
