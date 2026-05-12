import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createArtistRoutes } from "./artists.js";

const artistId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const intoId = "bbbbbbbb-cccc-dddd-eeee-ffffffffffff";

function mountApp(role: string, staffRole?: string) {
  const app = new Hono();
  const artistRegistryService = {
    review: vi.fn(),
    merge: vi.fn(),
    addAlias: vi.fn(),
    proposeMatches: vi.fn(),
    proposeMatchesForAdmin: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
  };
  const artistProfileService = {
    listPublic: vi.fn().mockResolvedValue([]),
  };
  const container = {
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    artistRegistryService,
    artistProfileService,
  } as unknown as Container;
  const authenticator: IAuthenticator = {
    getSessionUser: vi
      .fn()
      .mockResolvedValue({ id: "u1", role, ...(staffRole ? { staffRole } : {}) }),
  };
  app.route("/artists", createArtistRoutes(container, authenticator));
  return { app, artistRegistryService };
}

describe("artist admin routes — platform administrator gate", () => {
  it("returns 403 for POST /artists/:id/review when user is client", async () => {
    const { app, artistRegistryService } = mountApp("client");

    const res = await app.request(`/artists/${artistId}/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "approved" }),
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("Forbidden");
    expect(artistRegistryService.review).not.toHaveBeenCalled();
  });

  it("returns 403 for POST /artists/:id/merge when user is finance staff (finance_ops)", async () => {
    const { app, artistRegistryService } = mountApp("staff", "finance_ops");

    const res = await app.request(`/artists/${artistId}/merge`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        intoArtistId: intoId,
        reason: "duplicate catalogue entry",
      }),
    });

    expect(res.status).toBe(403);
    expect(artistRegistryService.merge).not.toHaveBeenCalled();
  });

  it("allows POST /artists/:id/review for staff (super_admin)", async () => {
    const { app, artistRegistryService } = mountApp("staff", "super_admin");
    artistRegistryService.review.mockResolvedValue({ id: artistId, status: "approved" });

    const res = await app.request(`/artists/${artistId}/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "approved" }),
    });

    expect(res.status).toBe(200);
    expect(artistRegistryService.review).toHaveBeenCalledWith("u1", artistId, {
      decision: "approved",
    });
  });

  it("allows POST /artists/:id/merge for staff (super_admin)", async () => {
    const { app, artistRegistryService } = mountApp("staff", "super_admin");
    artistRegistryService.findById.mockResolvedValue({
      id: intoId,
      displayName: "Canonical Name",
    });
    artistRegistryService.merge.mockResolvedValue({
      merged: { id: artistId },
      remaining: { id: intoId },
    });

    const res = await app.request(`/artists/${artistId}/merge`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        intoArtistId: intoId,
        reason: "duplicate catalogue entry",
        confirmationPhrase: "MERGE INTO Canonical Name",
      }),
    });

    expect(res.status).toBe(200);
    expect(artistRegistryService.merge).toHaveBeenCalledWith("u1", {
      fromArtistId: artistId,
      intoArtistId: intoId,
      reason: "duplicate catalogue entry",
    });
  });

  it("returns 400 when merge confirmation phrase is wrong", async () => {
    const { app, artistRegistryService } = mountApp("staff", "super_admin");
    artistRegistryService.findById.mockResolvedValue({
      id: intoId,
      displayName: "Canonical Name",
    });

    const res = await app.request(`/artists/${artistId}/merge`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        intoArtistId: intoId,
        reason: "duplicate catalogue entry",
        confirmationPhrase: "MERGE",
      }),
    });

    expect(res.status).toBe(400);
    expect(artistRegistryService.merge).not.toHaveBeenCalled();
  });

  it("returns 403 for POST /artists/propose-matches when user is client", async () => {
    const { app, artistRegistryService } = mountApp("client");

    const res = await app.request("/artists/propose-matches", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Banksy" }),
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("Forbidden");
    expect(artistRegistryService.proposeMatchesForAdmin).not.toHaveBeenCalled();
  });

  it("returns 403 for POST /artists/propose-matches when user is finance staff (finance_ops)", async () => {
    const { app, artistRegistryService } = mountApp("staff", "finance_ops");

    const res = await app.request("/artists/propose-matches", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Banksy" }),
    });

    expect(res.status).toBe(403);
    expect(artistRegistryService.proposeMatchesForAdmin).not.toHaveBeenCalled();
  });

  it("allows POST /artists/propose-matches for staff (super_admin)", async () => {
    const { app, artistRegistryService } = mountApp("staff", "super_admin");
    artistRegistryService.proposeMatchesForAdmin.mockResolvedValue({
      exact: [],
      alias: [],
      fuzzy: [],
    });

    const res = await app.request("/artists/propose-matches", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Banksy" }),
    });

    expect(res.status).toBe(200);
    expect(artistRegistryService.proposeMatchesForAdmin).toHaveBeenCalledWith("u1", {
      name: "Banksy",
    });
  });

  it("returns 403 for POST /artists/:id/aliases when user is client", async () => {
    const { app, artistRegistryService } = mountApp("client");

    const res = await app.request(`/artists/${artistId}/aliases`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ alias: "Known As" }),
    });

    expect(res.status).toBe(403);
    expect(artistRegistryService.addAlias).not.toHaveBeenCalled();
  });

  it("returns 403 for POST /artists/:id/aliases when user is finance staff (finance_ops)", async () => {
    const { app, artistRegistryService } = mountApp("staff", "finance_ops");

    const res = await app.request(`/artists/${artistId}/aliases`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ alias: "Known As" }),
    });

    expect(res.status).toBe(403);
    expect(artistRegistryService.addAlias).not.toHaveBeenCalled();
  });

  it("allows POST /artists/:id/aliases for staff (super_admin)", async () => {
    const { app, artistRegistryService } = mountApp("staff", "super_admin");
    artistRegistryService.addAlias.mockResolvedValue({ id: "alias-1", alias: "Known As" });

    const res = await app.request(`/artists/${artistId}/aliases`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ alias: "Known As" }),
    });

    expect(res.status).toBe(201);
    expect(artistRegistryService.addAlias).toHaveBeenCalledWith(
      "u1",
      artistId,
      "Known As",
      undefined,
    );
  });

  it("returns 403 for POST /artists when user is client", async () => {
    const { app, artistRegistryService } = mountApp("client");

    const res = await app.request("/artists", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName: "New Artist", kind: "artist" }),
    });

    expect(res.status).toBe(403);
    expect(artistRegistryService.create).not.toHaveBeenCalled();
  });

  it("returns 403 for POST /artists when user is finance staff (finance_ops)", async () => {
    const { app, artistRegistryService } = mountApp("staff", "finance_ops");

    const res = await app.request("/artists", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName: "New Artist", kind: "artist" }),
    });

    expect(res.status).toBe(403);
    expect(artistRegistryService.create).not.toHaveBeenCalled();
  });

  it("allows POST /artists for staff super_admin (records creator id)", async () => {
    const { app, artistRegistryService } = mountApp("staff", "super_admin");
    artistRegistryService.create.mockResolvedValue({
      id: artistId,
      displayName: "New Artist",
      slug: "new-artist",
      kind: "artist",
      status: "pending",
    });

    const res = await app.request("/artists", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName: "New Artist", kind: "artist" }),
    });

    expect(res.status).toBe(201);
    expect(artistRegistryService.create).toHaveBeenCalledWith("u1", {
      displayName: "New Artist",
      kind: "artist",
    });
  });
});
