import { verifyBearerToken } from "@auction/auth/token-verifier";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(),
}));

import { createShopApiApp } from "../../app.js";
import { createMinimalShopApiTestDeps } from "../../test-app-deps.js";

const headers = { authorization: "Bearer user-token" };

function asScope(scope: string, subject = "artist-subject-1") {
  vi.mocked(verifyBearerToken).mockResolvedValue({ subject, payload: { scope } } as never);
}

function app() {
  return createShopApiApp({ deps: createMinimalShopApiTestDeps(), logger: false });
}

afterEach(() => {
  vi.mocked(verifyBearerToken).mockReset();
});

describe("artist application routes", () => {
  it("reads the caller's state with a shop or a selling read scope", async () => {
    const server = app();
    for (const scope of ["shop.read", "lax.selling.read"]) {
      asScope(scope);
      const response = await server.inject({
        method: "GET",
        url: "/v1/me/artist-application",
        headers,
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ application: null, next: "start", availableFrom: null });
    }
  });

  it("starts a draft only with the shop write scope", async () => {
    const server = app();
    asScope("lax.selling.read");
    const refused = await server.inject({
      method: "POST",
      url: "/v1/me/artist-application",
      headers,
    });
    expect(refused.statusCode).toBe(403);
    asScope("shop.write");
    const started = await server.inject({
      method: "POST",
      url: "/v1/me/artist-application",
      headers,
    });
    expect(started.statusCode).toBe(200);
    expect(started.json()).toMatchObject({ status: "draft", editable: true, version: 1 });
  });

  it("lists what is missing when an incomplete application is sent", async () => {
    const server = app();
    asScope("shop.write");
    const draft = (
      await server.inject({ method: "POST", url: "/v1/me/artist-application", headers })
    ).json() as { id: string; version: number };
    const response = await server.inject({
      method: "POST",
      url: `/v1/me/artist-application/${draft.id}/submit`,
      headers,
      payload: { expectedVersion: draft.version },
    });
    expect(response.statusCode).toBe(400);
    const body = response.json() as { blockers: Array<{ step: string; field: string }> };
    expect(body.blockers.map((blocker) => blocker.step)).toContain("work");
  });

  it("hides one account's application from another", async () => {
    const server = app();
    asScope("shop.write", "artist-subject-1");
    const draft = (
      await server.inject({ method: "POST", url: "/v1/me/artist-application", headers })
    ).json() as { id: string; version: number };
    asScope("shop.write", "someone-else");
    const response = await server.inject({
      method: "PUT",
      url: `/v1/me/artist-application/${draft.id}`,
      headers,
      payload: {
        expectedVersion: draft.version,
        artistName: "Not mine",
        location: null,
        website: null,
        socialLinks: [],
        shortBio: null,
        statement: null,
        representation: null,
        exhibitions: null,
        consentToContact: false,
        works: [],
      },
    });
    expect(response.statusCode).toBe(404);
  });

  it("refuses a draft over the limits the contract sets", async () => {
    const server = app();
    asScope("shop.write");
    const draft = (
      await server.inject({ method: "POST", url: "/v1/me/artist-application", headers })
    ).json() as { id: string; version: number };
    const response = await server.inject({
      method: "PUT",
      url: `/v1/me/artist-application/${draft.id}`,
      headers,
      payload: {
        expectedVersion: draft.version,
        artistName: "x".repeat(121),
        location: null,
        website: null,
        socialLinks: [],
        shortBio: null,
        statement: null,
        representation: null,
        exhibitions: null,
        consentToContact: false,
        works: [],
      },
    });
    expect(response.statusCode).toBe(400);
  });
});
