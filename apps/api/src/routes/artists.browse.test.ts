import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createArtistRoutes } from "./artists.js";

describe("GET /artists/browse", () => {
  it("routes to browsePublic instead of :id param validation", async () => {
    const browsePublic = vi.fn().mockResolvedValue({
      items: [],
      total: 0,
      facets: { kinds: {}, decades: {}, nationalities: {} },
    });
    const container = {
      userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
      artistRegistryService: {},
      artistProfileService: {
        listPublic: vi.fn(),
        browsePublic,
      },
    } as unknown as Container;
    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue(null),
    };
    const app = new Hono();
    app.route("/artists", createArtistRoutes(container, authenticator));

    const res = await app.request("/artists/browse?limit=24&offset=0&sort=name_asc");

    expect(res.status).toBe(200);
    expect(browsePublic).toHaveBeenCalled();
    const body = (await res.json()) as { data?: unknown };
    expect(body.data).toBeDefined();
  });
});
