import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { ContainerLegalEntityRoutesSlice } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createLegalEntityRoutes } from "./legal-entities.js";

const GALLERY = "00000000-0000-4000-8000-000000000002";

function mount(legalEntityHttp: Record<string, ReturnType<typeof vi.fn>>) {
  const container = {
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    identityRoutes: { legalEntityHttp },
  } as unknown as ContainerLegalEntityRoutesSlice;
  const authenticator: IAuthenticator = {
    getSessionUser: vi
      .fn()
      .mockResolvedValue({ id: "user-1", role: "client", scopes: ["bid.read", "bid.write"] }),
  };
  const app = new Hono();
  app.route("/legal-entities", createLegalEntityRoutes(container, authenticator));
  return app;
}

describe("GET /legal-entities/me", () => {
  it("is a short private read, never kept by a shared cache", async () => {
    const listMyMemberships = vi.fn().mockResolvedValue({ kind: "ok", data: [] });
    const res = await mount({ listMyMemberships }).request("/legal-entities/me");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, max-age=10");
    expect(res.headers.get("vary")).toBe("Authorization, Cookie");
  });

  it("is never cached when the personal account could not be prepared", async () => {
    const listMyMemberships = vi.fn().mockResolvedValue({
      kind: "err",
      error: {
        message: "personal_entity_unavailable",
        status: 503,
        code: "personal_entity_unavailable",
      },
    });
    const res = await mount({ listMyMemberships }).request("/legal-entities/me");
    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("POST /legal-entities/invitations/preview", () => {
  it("reads the link for the signed-in person", async () => {
    const preview = {
      state: "already_member",
      legalEntityId: GALLERY,
      organisationName: "Northbank Gallery",
    };
    const previewInvitationByToken = vi.fn().mockResolvedValue({ kind: "ok", data: preview });
    const res = await mount({ previewInvitationByToken }).request(
      "/legal-entities/invitations/preview",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "invitation-token-123" }),
      },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    await expect(res.json()).resolves.toEqual({ data: preview });
    expect(previewInvitationByToken).toHaveBeenCalledWith({
      userId: "user-1",
      token: "invitation-token-123",
    });
  });

  it("rejects a malformed token before reaching the service", async () => {
    const previewInvitationByToken = vi.fn();
    const res = await mount({ previewInvitationByToken }).request(
      "/legal-entities/invitations/preview",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "short" }),
      },
    );
    expect(res.status).toBe(400);
    expect(previewInvitationByToken).not.toHaveBeenCalled();
  });
});
