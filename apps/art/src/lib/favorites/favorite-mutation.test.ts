import type { ArtCommerceMutationClient } from "@/lib/art-commerce-mutation.server";
import { describe, expect, it, vi } from "vitest";
import {
  favoriteMutationPath,
  interpretFavoriteMutation,
  mutateFavorite,
} from "./favorite-mutation.js";

function fakeClient(result: Awaited<ReturnType<ArtCommerceMutationClient["mutate"]>>) {
  return { mutate: vi.fn().mockResolvedValue(result) } satisfies ArtCommerceMutationClient;
}

describe("favorite mutation", () => {
  it("encodes slugs into the BFF favorites paths", () => {
    expect(favoriteMutationPath("artwork", "a b")).toBe("/commerce/me/favorites/artworks/a%20b");
    expect(favoriteMutationPath("artist", "flora")).toBe("/commerce/me/favorites/artists/flora");
  });

  it("saves with PUT and removes with DELETE", async () => {
    const client = fakeClient({ kind: "response", status: 200, body: { status: "saved" } });
    await expect(
      mutateFavorite(client, { target: "artwork", slug: "work", active: true }),
    ).resolves.toEqual({
      ok: true,
      active: true,
    });
    expect(client.mutate).toHaveBeenCalledWith("/commerce/me/favorites/artworks/work", {
      method: "PUT",
    });

    const remove = fakeClient({
      kind: "response",
      status: 200,
      body: { status: "already_removed" },
    });
    await expect(
      mutateFavorite(remove, { target: "artist", slug: "flora", active: false }),
    ).resolves.toEqual({
      ok: true,
      active: false,
    });
    expect(remove.mutate).toHaveBeenCalledWith("/commerce/me/favorites/artists/flora", {
      method: "DELETE",
    });
  });

  it("rejects empty slugs without calling the BFF", async () => {
    const client = fakeClient({ kind: "response", status: 200, body: null });
    const outcome = await mutateFavorite(client, { target: "artwork", slug: " ", active: true });
    expect(outcome).toMatchObject({ ok: false, reason: "invalid" });
    expect(client.mutate).not.toHaveBeenCalled();
  });

  it.each([
    [{ kind: "response", status: 401, body: {} }, "sign_in_required"],
    [{ kind: "response", status: 403, body: { error: "csrf_failed" } }, "session_expired"],
    [{ kind: "csrf_unavailable" }, "session_expired"],
    [{ kind: "response", status: 404, body: {} }, "not_found"],
    [{ kind: "response", status: 502, body: null }, "unavailable"],
    [{ kind: "network_error" }, "unavailable"],
  ] as const)("maps %o to %s", (result, reason) => {
    expect(interpretFavoriteMutation("artwork", true, result)).toMatchObject({ ok: false, reason });
  });

  it("trusts the requested state when the body is not a known status", () => {
    expect(
      interpretFavoriteMutation("artwork", false, { kind: "response", status: 204, body: null }),
    ).toEqual({ ok: true, active: false });
  });
});
