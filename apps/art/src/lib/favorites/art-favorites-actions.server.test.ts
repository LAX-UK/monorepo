import { beforeEach, describe, expect, it, vi } from "vitest";

const bff = vi.hoisted(() => ({ mutate: vi.fn() }));
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/art-commerce-mutation.server", () => ({ artCommerceMutationClient: bff }));
vi.mock("next/cache", () => cache);

import {
  followArtist,
  removeArtworkFavorite,
  saveArtworkFavorite,
  unfollowArtist,
} from "./art-favorites-actions.server.js";

describe("art favorites server actions", () => {
  beforeEach(() => {
    bff.mutate.mockReset();
    cache.revalidatePath.mockReset();
  });

  it("saves an artwork and revalidates the favorites tab", async () => {
    bff.mutate.mockResolvedValue({ kind: "response", status: 200, body: { status: "saved" } });
    await expect(saveArtworkFavorite("work")).resolves.toEqual({ ok: true, active: true });
    expect(bff.mutate).toHaveBeenCalledWith("/commerce/me/favorites/artworks/work", {
      method: "PUT",
    });
    expect(cache.revalidatePath).toHaveBeenCalledWith("/account/favourites");
  });

  it("removes an artwork", async () => {
    bff.mutate.mockResolvedValue({ kind: "response", status: 200, body: { status: "removed" } });
    await expect(removeArtworkFavorite("work")).resolves.toEqual({ ok: true, active: false });
    expect(bff.mutate).toHaveBeenCalledWith("/commerce/me/favorites/artworks/work", {
      method: "DELETE",
    });
  });

  it("follows and unfollows artists", async () => {
    bff.mutate.mockResolvedValueOnce({
      kind: "response",
      status: 200,
      body: { status: "followed" },
    });
    await expect(followArtist("flora")).resolves.toEqual({ ok: true, active: true });
    bff.mutate.mockResolvedValueOnce({
      kind: "response",
      status: 200,
      body: { status: "removed" },
    });
    await expect(unfollowArtist("flora")).resolves.toEqual({ ok: true, active: false });
    expect(bff.mutate).toHaveBeenNthCalledWith(1, "/commerce/me/favorites/artists/flora", {
      method: "PUT",
    });
    expect(bff.mutate).toHaveBeenNthCalledWith(2, "/commerce/me/favorites/artists/flora", {
      method: "DELETE",
    });
  });

  it("does not revalidate when the BFF rejects the viewer", async () => {
    bff.mutate.mockResolvedValue({ kind: "response", status: 401, body: {} });
    await expect(saveArtworkFavorite("work")).resolves.toMatchObject({
      ok: false,
      reason: "sign_in_required",
    });
    expect(cache.revalidatePath).not.toHaveBeenCalled();
  });
});
