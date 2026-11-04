import type { ArtworkRegisterEntry } from "@auction/artwork-register-contracts";
import { describe, expect, it, vi } from "vitest";
import type { OriginalForMove } from "../ports/original-move.js";
import { ReopenArtListingService } from "./reopen-art-listing.service.js";

const request = {
  registerId: "22222222-2222-4222-8222-222222222222",
  actor: "staff:user-1",
};

const original = (over: Partial<OriginalForMove> = {}) =>
  ({ artworkId: "art-1", runKind: null, archived: false, ...over }) as OriginalForMove;

function setup(
  found: OriginalForMove | null,
  entry: ArtworkRegisterEntry | null = { zohoProductId: "z-1" } as ArtworkRegisterEntry,
) {
  const restoreListing = vi.fn().mockResolvedValue(undefined);
  const service = new ReopenArtListingService({
    originals: { findById: vi.fn(), findByZohoProductId: vi.fn().mockResolvedValue(found) },
    register: { findById: vi.fn().mockResolvedValue(entry) },
    restoreListing,
  });
  return { service, restoreListing };
}

describe("ReopenArtListingService", () => {
  it("restores an archived listing as a draft", async () => {
    const { service, restoreListing } = setup(original({ archived: true }));
    expect(await service.reopen(request)).toEqual({
      ok: true,
      data: { artworkId: "art-1", reopened: true },
    });
    expect(restoreListing).toHaveBeenCalledWith({ artworkId: "art-1", actor: "staff:user-1" });
  });

  it("leaves a listing that is already a draft, so asking twice is safe", async () => {
    const { service, restoreListing } = setup(original());
    expect(await service.reopen(request)).toEqual({
      ok: true,
      data: { artworkId: "art-1", reopened: false },
    });
    expect(restoreListing).not.toHaveBeenCalled();
  });

  it("says so when lax.art has no record of the artwork, or only an edition", async () => {
    expect(await setup(null).service.reopen(request)).toMatchObject({
      ok: false,
      status: 409,
      refusal: { error: "no_listing" },
    });
    expect(await setup(original({ runKind: "open" })).service.reopen(request)).toMatchObject({
      ok: false,
      refusal: { error: "no_listing" },
    });
  });

  it("answers 404 for a register record that does not exist", async () => {
    expect(await setup(original(), null).service.reopen(request)).toMatchObject({
      ok: false,
      status: 404,
      refusal: { error: "register_not_found" },
    });
  });
});
