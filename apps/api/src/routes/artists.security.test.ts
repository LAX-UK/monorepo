import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import { ArtistError } from "../lib/errors.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { stubCatalogRouteServices } from "../testing/stub-catalog-route-services.js";
import { createArtistRoutes } from "./artists.js";

const artistId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const intoId = "bbbbbbbb-cccc-dddd-eeee-ffffffffffff";

function mountApp(role: string, staffRole?: string) {
  const app = new Hono();
  const artistHttp = stubCatalogRouteServices().artistHttp;
  const container = {
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    catalogRoutes: stubCatalogRouteServices({ artistHttp }),
  } as unknown as Container;
  const authenticator: IAuthenticator = {
    getSessionUser: vi
      .fn()
      .mockResolvedValue({ id: "u1", role, ...(staffRole ? { staffRole } : {}) }),
  };
  app.route("/artists", createArtistRoutes(container, authenticator));
  return { app, artistHttp };
}

describe("artist admin routes — platform administrator gate", () => {
  it("returns 403 for POST /artists/:id/review when user is client", async () => {
    const { app, artistHttp } = mountApp("client");

    const res = await app.request(`/artists/${artistId}/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "approved" }),
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("Forbidden");
    expect(artistHttp.review).not.toHaveBeenCalled();
  });

  it("returns 403 for POST /artists/:id/merge when user is finance staff (finance_ops)", async () => {
    const { app, artistHttp } = mountApp("staff", "finance_ops");

    const res = await app.request(`/artists/${artistId}/merge`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        intoArtistId: intoId,
        reason: "duplicate catalogue entry",
      }),
    });

    expect(res.status).toBe(403);
    expect(artistHttp.mergeWithConfirmation).not.toHaveBeenCalled();
  });

  it("allows POST /artists/:id/review for staff (super_admin)", async () => {
    const { app, artistHttp } = mountApp("staff", "super_admin");
    vi.mocked(artistHttp.review).mockResolvedValue({
      status: 200,
      body: { data: { id: artistId, status: "approved" } },
    });

    const res = await app.request(`/artists/${artistId}/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "approved" }),
    });

    expect(res.status).toBe(200);
    expect(artistHttp.review).toHaveBeenCalledWith({
      userId: "u1",
      id: artistId,
      body: { decision: "approved" },
    });
  });

  it("allows POST /artists/:id/merge for staff (super_admin)", async () => {
    const { app, artistHttp } = mountApp("staff", "super_admin");
    vi.mocked(artistHttp.mergeWithConfirmation).mockResolvedValue({
      status: 200,
      body: {
        data: {
          merged: { id: artistId },
          remaining: { id: intoId },
        },
      },
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
    expect(artistHttp.mergeWithConfirmation).toHaveBeenCalledWith({
      userId: "u1",
      fromArtistId: artistId,
      body: {
        intoArtistId: intoId,
        reason: "duplicate catalogue entry",
        confirmationPhrase: "MERGE INTO Canonical Name",
      },
    });
  });

  it("returns 400 when merge confirmation phrase is wrong", async () => {
    const { app, artistHttp } = mountApp("staff", "super_admin");
    vi.mocked(artistHttp.mergeWithConfirmation).mockResolvedValue({
      status: 400,
      body: {
        error: "confirmation_mismatch",
        message: "Type exactly: MERGE INTO Canonical Name",
      },
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
    expect(artistHttp.mergeWithConfirmation).toHaveBeenCalledWith({
      userId: "u1",
      fromArtistId: artistId,
      body: {
        intoArtistId: intoId,
        reason: "duplicate catalogue entry",
        confirmationPhrase: "MERGE",
      },
    });
  });

  it("returns 403 for POST /artists/propose-matches when user is client", async () => {
    const { app, artistHttp } = mountApp("client");

    const res = await app.request("/artists/propose-matches", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Banksy" }),
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("Forbidden");
    expect(artistHttp.proposeMatchesForAdmin).not.toHaveBeenCalled();
  });

  it("returns 403 for POST /artists/propose-matches when user is finance staff (finance_ops)", async () => {
    const { app, artistHttp } = mountApp("staff", "finance_ops");

    const res = await app.request("/artists/propose-matches", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Banksy" }),
    });

    expect(res.status).toBe(403);
    expect(artistHttp.proposeMatchesForAdmin).not.toHaveBeenCalled();
  });

  it("allows POST /artists/propose-matches for staff (super_admin)", async () => {
    const { app, artistHttp } = mountApp("staff", "super_admin");
    vi.mocked(artistHttp.proposeMatchesForAdmin).mockResolvedValue({
      status: 200,
      body: { data: { exact: [], alias: [], fuzzy: [] } },
    });

    const res = await app.request("/artists/propose-matches", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Banksy" }),
    });

    expect(res.status).toBe(200);
    expect(artistHttp.proposeMatchesForAdmin).toHaveBeenCalledWith({
      userId: "u1",
      body: { name: "Banksy" },
    });
  });

  it("returns 403 for POST /artists/:id/aliases when user is client", async () => {
    const { app, artistHttp } = mountApp("client");

    const res = await app.request(`/artists/${artistId}/aliases`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ alias: "Known As" }),
    });

    expect(res.status).toBe(403);
    expect(artistHttp.addAlias).not.toHaveBeenCalled();
  });

  it("returns 403 for POST /artists/:id/aliases when user is finance staff (finance_ops)", async () => {
    const { app, artistHttp } = mountApp("staff", "finance_ops");

    const res = await app.request(`/artists/${artistId}/aliases`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ alias: "Known As" }),
    });

    expect(res.status).toBe(403);
    expect(artistHttp.addAlias).not.toHaveBeenCalled();
  });

  it("allows POST /artists/:id/aliases for staff (super_admin)", async () => {
    const { app, artistHttp } = mountApp("staff", "super_admin");
    vi.mocked(artistHttp.addAlias).mockResolvedValue({
      status: 201,
      body: { data: { id: "alias-1", alias: "Known As" } },
    });

    const res = await app.request(`/artists/${artistId}/aliases`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ alias: "Known As" }),
    });

    expect(res.status).toBe(201);
    expect(artistHttp.addAlias).toHaveBeenCalledWith({
      userId: "u1",
      id: artistId,
      alias: "Known As",
      kind: undefined,
    });
  });

  it("returns 403 for POST /artists when user is client", async () => {
    const { app, artistHttp } = mountApp("client");

    const res = await app.request("/artists", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName: "New Artist", kind: "artist" }),
    });

    expect(res.status).toBe(403);
    expect(artistHttp.create).not.toHaveBeenCalled();
  });

  it("returns 403 for POST /artists when user is finance staff (finance_ops)", async () => {
    const { app, artistHttp } = mountApp("staff", "finance_ops");

    const res = await app.request("/artists", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName: "New Artist", kind: "artist" }),
    });

    expect(res.status).toBe(403);
    expect(artistHttp.create).not.toHaveBeenCalled();
  });

  it("allows POST /artists for staff super_admin (records creator id)", async () => {
    const { app, artistHttp } = mountApp("staff", "super_admin");
    vi.mocked(artistHttp.create).mockResolvedValue({
      status: 201,
      body: {
        data: {
          id: artistId,
          displayName: "New Artist",
          slug: "new-artist",
          kind: "artist",
          status: "pending",
        },
      },
    });

    const res = await app.request("/artists", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName: "New Artist", kind: "artist" }),
    });

    expect(res.status).toBe(201);
    expect(artistHttp.create).toHaveBeenCalledWith({
      userId: "u1",
      body: { displayName: "New Artist", kind: "artist" },
    });
  });
});

describe("artist delete routes — artist.delete gate", () => {
  it("returns 403 for DELETE /artists/:id when user is specialist", async () => {
    const { app, artistHttp } = mountApp("staff", "specialist");

    const res = await app.request(`/artists/${artistId}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirmationPhrase: "DELETE Test" }),
    });

    expect(res.status).toBe(403);
    expect(artistHttp.delete).not.toHaveBeenCalled();
  });

  it("allows DELETE /artists/:id for catalogue_manager", async () => {
    const { app, artistHttp } = mountApp("staff", "catalogue_manager");
    vi.mocked(artistHttp.delete).mockResolvedValue({ kind: "no_content" });

    const res = await app.request(`/artists/${artistId}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirmationPhrase: "DELETE Test Artist" }),
    });

    expect(res.status).toBe(204);
    expect(artistHttp.delete).toHaveBeenCalled();
  });

  it("returns 403 for GET delete-eligibility when user is staff_viewer", async () => {
    const { app, artistHttp } = mountApp("staff", "staff_viewer");

    const res = await app.request(`/artists/${artistId}/delete-eligibility`);

    expect(res.status).toBe(403);
    expect(artistHttp.getDeleteEligibility).not.toHaveBeenCalled();
  });

  it("allows GET delete-eligibility for super_admin", async () => {
    const { app, artistHttp } = mountApp("staff", "super_admin");
    vi.mocked(artistHttp.getDeleteEligibility).mockResolvedValue({
      status: 200,
      body: {
        data: {
          canDelete: true,
          blockers: [],
          warnings: [],
          confirmationPhrase: "DELETE Test",
          guards: { lotCount: 0, mergeDependentCount: 0, watchlistCount: 0 },
        },
      },
    });

    const res = await app.request(`/artists/${artistId}/delete-eligibility`);

    expect(res.status).toBe(200);
    expect(artistHttp.getDeleteEligibility).toHaveBeenCalledWith({ id: artistId });
  });

  it("returns 400 when delete confirmation phrase is wrong", async () => {
    const { app, artistHttp } = mountApp("staff", "catalogue_manager");
    vi.mocked(artistHttp.delete).mockResolvedValue({
      kind: "err",
      error: new ArtistError(
        "Type exactly: DELETE Canonical Name",
        400,
        "artist_delete_phrase_mismatch",
      ),
    });

    const res = await app.request(`/artists/${artistId}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirmationPhrase: "DELETE Wrong" }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("artist_delete_phrase_mismatch");
  });

  it("returns 422 when delete is blocked by policy", async () => {
    const { app, artistHttp } = mountApp("staff", "super_admin");
    vi.mocked(artistHttp.delete).mockResolvedValue({
      kind: "err",
      error: new ArtistError("This artist is attributed to 2 lots", 422, "artist_delete_blocked", [
        "This artist is attributed to 2 lots",
      ]),
    });

    const res = await app.request(`/artists/${artistId}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirmationPhrase: "DELETE Test Artist" }),
    });

    expect(res.status).toBe(422);
    const body = (await res.json()) as { code?: string; blockers?: string[] };
    expect(body.code).toBe("artist_delete_blocked");
    expect(body.blockers).toEqual(["This artist is attributed to 2 lots"]);
  });
});
