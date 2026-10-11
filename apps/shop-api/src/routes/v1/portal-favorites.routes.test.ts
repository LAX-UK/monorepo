import { verifyBearerToken } from "@auction/auth/token-verifier";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(async () => ({
    subject: "collector-1",
    payload: { scope: "shop.read shop.write" },
  })),
}));

import { createShopApiApp } from "../../app.js";
import { createPortalFavoritesHandlers } from "../../application/handlers/portal-favorites.handler.js";
import type { PortalFavoritesPort } from "../../application/ports/portal-favorites.port.js";
import { createMinimalShopApiTestDeps } from "../../test-app-deps.js";

const userHeaders = { authorization: "Bearer user-token" };
const bffHeaders = { authorization: "Bearer test-bff-token-minimum-32-characters-long" };

const KNOWN_ARTWORKS = new Set(["known-work"]);
const KNOWN_ARTISTS = new Set(["known-artist"]);

function createInMemoryFavoritesPort(): PortalFavoritesPort {
  const saved = new Set<string>();
  const followed = new Set<string>();
  const key = (subject: string, slug: string) => `${subject}:${slug}`;
  return {
    listSavedArtworks: async (subject) =>
      [...saved]
        .filter((k) => k.startsWith(`${subject}:`))
        .map((k) => ({
          artworkSlug: k.slice(subject.length + 1),
          artworkTitle: "Known Work",
          artistName: "Known Artist",
          artistSlug: "known-artist",
          imageUrl: null,
          salesChannel: "art" as const,
          savedAt: "2026-01-01T00:00:00.000Z",
        })),
    saveArtwork: async (subject, slug) => {
      if (!KNOWN_ARTWORKS.has(slug)) return "artwork_not_found";
      if (saved.has(key(subject, slug))) return "already_saved";
      saved.add(key(subject, slug));
      return "saved";
    },
    unsaveArtwork: async (subject, slug) => {
      if (!KNOWN_ARTWORKS.has(slug)) return "artwork_not_found";
      return saved.delete(key(subject, slug)) ? "removed" : "not_saved";
    },
    listFollowedArtists: async (subject) =>
      [...followed]
        .filter((k) => k.startsWith(`${subject}:`))
        .map((k) => ({
          artistSlug: k.slice(subject.length + 1),
          artistName: "Known Artist",
          portraitUrl: null,
          followedAt: "2026-01-01T00:00:00.000Z",
        })),
    followArtist: async (subject, slug) => {
      if (!KNOWN_ARTISTS.has(slug)) return "artist_not_found";
      if (followed.has(key(subject, slug))) return "already_followed";
      followed.add(key(subject, slug));
      return "followed";
    },
    unfollowArtist: async (subject, slug) => {
      if (!KNOWN_ARTISTS.has(slug)) return "artist_not_found";
      return followed.delete(key(subject, slug)) ? "removed" : "not_following";
    },
  };
}

async function buildApp(options: { portalEnabled?: boolean } = {}) {
  const base = createMinimalShopApiTestDeps();
  const app = createShopApiApp({
    deps: createMinimalShopApiTestDeps({
      env: { ...base.env, SHOP_PORTAL_OWNERSHIP_ENABLED: options.portalEnabled ?? true },
      portal: {
        ...base.portal,
        portalFavorites: createPortalFavoritesHandlers(createInMemoryFavoritesPort()),
      },
    }),
    logger: false,
  });
  await app.ready();
  return app;
}

describe("portal favorites routes", () => {
  afterEach(() => {
    vi.mocked(verifyBearerToken).mockClear();
  });

  it.each([
    ["GET", "/v1/me/favorites/artworks"],
    ["PUT", "/v1/me/favorites/artworks/known-work"],
    ["DELETE", "/v1/me/favorites/artists/known-artist"],
  ] as const)("requires a bearer token for %s %s", async (method, url) => {
    const app = await buildApp();
    const response = await app.inject({ method, url });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("rejects BFF tokens because favorites need a user subject", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "PUT",
      url: "/v1/me/favorites/artworks/known-work",
      headers: bffHeaders,
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("requires shop.write for mutations", async () => {
    vi.mocked(verifyBearerToken).mockResolvedValueOnce({
      subject: "collector-1",
      payload: { scope: "shop.read" },
    } as never);
    const app = await buildApp();
    const response = await app.inject({
      method: "PUT",
      url: "/v1/me/favorites/artists/known-artist",
      headers: userHeaders,
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it.each([
    ["PUT", "/v1/me/favorites/artworks/missing-work"],
    ["DELETE", "/v1/me/favorites/artworks/missing-work"],
    ["PUT", "/v1/me/favorites/artists/missing-artist"],
    ["DELETE", "/v1/me/favorites/artists/missing-artist"],
  ] as const)("returns 404 for %s on an unknown slug", async (method, url) => {
    const app = await buildApp();
    const response = await app.inject({ method, url, headers: userHeaders });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ code: "shop.not_found" });
    await app.close();
  });

  it("saves and removes artworks idempotently and lists the caller's saves", async () => {
    const app = await buildApp();
    const url = "/v1/me/favorites/artworks/known-work";

    const first = await app.inject({ method: "PUT", url, headers: userHeaders });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual({ status: "saved" });

    const repeat = await app.inject({ method: "PUT", url, headers: userHeaders });
    expect(repeat.statusCode).toBe(200);
    expect(repeat.json()).toEqual({ status: "already_saved" });

    const list = await app.inject({
      method: "GET",
      url: "/v1/me/favorites/artworks",
      headers: userHeaders,
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().items).toEqual([expect.objectContaining({ artworkSlug: "known-work" })]);

    const removed = await app.inject({ method: "DELETE", url, headers: userHeaders });
    expect(removed.json()).toEqual({ status: "removed" });

    const removedAgain = await app.inject({ method: "DELETE", url, headers: userHeaders });
    expect(removedAgain.statusCode).toBe(200);
    expect(removedAgain.json()).toEqual({ status: "already_removed" });
    await app.close();
  });

  it("follows and unfollows artists idempotently and lists the caller's follows", async () => {
    const app = await buildApp();
    const url = "/v1/me/favorites/artists/known-artist";

    expect((await app.inject({ method: "PUT", url, headers: userHeaders })).json()).toEqual({
      status: "followed",
    });
    expect((await app.inject({ method: "PUT", url, headers: userHeaders })).json()).toEqual({
      status: "already_followed",
    });

    const list = await app.inject({
      method: "GET",
      url: "/v1/me/favorites/artists",
      headers: userHeaders,
    });
    expect(list.json().items).toEqual([expect.objectContaining({ artistSlug: "known-artist" })]);

    expect((await app.inject({ method: "DELETE", url, headers: userHeaders })).json()).toEqual({
      status: "removed",
    });
    expect((await app.inject({ method: "DELETE", url, headers: userHeaders })).json()).toEqual({
      status: "already_removed",
    });
    await app.close();
  });

  it.each([
    ["GET", "/v1/me/favorites/artworks"],
    ["PUT", "/v1/me/favorites/artworks/known-work"],
    ["GET", "/v1/me/favorites/artists"],
    ["DELETE", "/v1/me/favorites/artists/known-artist"],
  ] as const)(
    "returns feature_disabled for %s %s when portal ownership is off",
    async (method, url) => {
      const app = await buildApp({ portalEnabled: false });
      const response = await app.inject({ method, url, headers: userHeaders });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({ code: "shop.feature_disabled" });
      await app.close();
    },
  );
});
