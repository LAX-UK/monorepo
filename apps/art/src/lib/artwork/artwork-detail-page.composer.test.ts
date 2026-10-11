import { SIGNED_IN_VIEWER, artworkDetail, fakeArtServices } from "@/lib/testing/fake-art-services";
import { describe, expect, it } from "vitest";
import {
  composeArtworkDetailMetadata,
  composeArtworkDetailPage,
} from "./artwork-detail-page.composer.js";

describe("composeArtworkDetailPage", () => {
  it("returns not_found for unknown slugs", async () => {
    const services = fakeArtServices();
    await expect(
      composeArtworkDetailPage(services, { slug: "missing", enquireRequested: false }),
    ).resolves.toEqual({ kind: "not_found" });
  });

  it("returns unavailable when the catalogue fails", async () => {
    const services = fakeArtServices();
    services.catalogue.getArtwork.mockRejectedValue(new Error("down"));
    await expect(
      composeArtworkDetailPage(services, { slug: "warm-basket", enquireRequested: false }),
    ).resolves.toEqual({ kind: "unavailable" });
  });

  it("sends guests to sign in and back to the open enquiry sheet", async () => {
    const services = fakeArtServices();
    services.catalogue.getArtwork.mockResolvedValue(artworkDetail());

    const result = await composeArtworkDetailPage(services, {
      slug: "warm-basket",
      enquireRequested: true,
    });

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.vm.enquiry).toEqual({
      kind: "sign_in",
      loginHref: "/login?returnTo=%2Fartworks%2Fwarm-basket%3Fenquire%3D1",
    });
    expect(result.vm.priceLabel).toBe("Price on request");
    expect(result.vm.metaLine).toBe("2024 · Oil on linen · 40 × 50 cm");
    expect(result.vm.favoriteAuth.loginHref).toBe("/login?returnTo=%2Fartworks%2Fwarm-basket");
  });

  it("prefills the enquiry contact and saved state for signed-in viewers", async () => {
    const services = fakeArtServices(SIGNED_IN_VIEWER);
    services.catalogue.getArtwork.mockResolvedValue(artworkDetail());
    services.favorites.savedArtworkSlugs.mockResolvedValue(new Set(["warm-basket"]));

    const result = await composeArtworkDetailPage(services, {
      slug: "warm-basket",
      enquireRequested: true,
    });

    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.vm.enquiry).toEqual({
      kind: "ready",
      contact: { name: "Ada Collector", email: "ada@example.com", phone: "+447700900123" },
      autoOpen: true,
    });
    expect(result.vm.saved).toBe(true);
  });

  it("closes enquiries on sold works", async () => {
    const services = fakeArtServices(SIGNED_IN_VIEWER);
    services.catalogue.getArtwork.mockResolvedValue(artworkDetail({ saleState: "sold" }));

    const result = await composeArtworkDetailPage(services, {
      slug: "warm-basket",
      enquireRequested: true,
    });

    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.vm.enquiry).toEqual({ kind: "unavailable" });
    expect(result.vm.priceLabel).toBe("Sold");
  });
});

describe("composeArtworkDetailMetadata", () => {
  it("builds canonical metadata", async () => {
    const services = fakeArtServices();
    services.catalogue.getArtwork.mockResolvedValue(artworkDetail({ description: null }));
    await expect(composeArtworkDetailMetadata(services.catalogue, "warm-basket")).resolves.toEqual({
      kind: "ok",
      title: "Warm Basket",
      description: "Warm Basket by Flora Powers at LAX Art.",
      canonicalPath: "/artworks/warm-basket",
      imageUrl: "/warm-basket.webp",
    });
  });
});
