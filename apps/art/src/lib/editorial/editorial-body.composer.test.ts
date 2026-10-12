import { artworkDetail, fakeArtServices } from "@/lib/testing/fake-art-services";
import type { EditorialBlock } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import { EDITORIAL_RAIL_MAX_LOOKUPS, composeEditorialBody } from "./editorial-body.composer.js";

describe("composeEditorialBody", () => {
  it("skips catalogue and viewer reads when the body has no rails", async () => {
    const services = fakeArtServices();
    const blocks: EditorialBlock[] = [{ type: "heading", level: 2, text: "Hello" }];

    const vm = await composeEditorialBody(blocks, services, "/stories/a");

    expect(vm).toEqual({ blocks, rails: {} });
    expect(services.catalogue.getArtwork).not.toHaveBeenCalled();
    expect(services.viewer.load).not.toHaveBeenCalled();
  });

  it("resolves artwork rails in editor order and drops missing works", async () => {
    const services = fakeArtServices();
    services.catalogue.getArtwork.mockImplementation(async (slug: string) =>
      slug === "gone" ? null : artworkDetail({ slug, title: slug }),
    );

    const vm = await composeEditorialBody(
      [
        { type: "heading", level: 2, text: "Works" },
        { type: "artworkRail", headline: "In the show", artworkSlugs: ["b", "gone", "a"] },
      ],
      services,
      "/exhibitions/show",
    );

    const rail = vm.rails[1];
    expect(rail?.kind).toBe("artworks");
    expect(rail?.cards.map((card) => card.slug)).toEqual(["b", "a"]);
    expect(rail?.headline).toBe("In the show");
  });

  it("omits a rail when every lookup fails and de-duplicates lookups across rails", async () => {
    const services = fakeArtServices();
    services.catalogue.getArtwork.mockRejectedValue(new Error("down"));

    const vm = await composeEditorialBody(
      [
        { type: "artworkRail", artworkSlugs: ["a", "b"] },
        { type: "artworkRail", artworkSlugs: ["a"] },
      ],
      services,
      "/",
    );

    expect(vm.rails).toEqual({});
    expect(services.catalogue.getArtwork).toHaveBeenCalledTimes(2);
  });

  it("caps catalogue lookups per page", async () => {
    const services = fakeArtServices();
    const slugs = Array.from({ length: 24 }, (_, i) => `w-${i}`);

    await composeEditorialBody(
      [
        { type: "artworkRail", artworkSlugs: slugs },
        { type: "artworkRail", artworkSlugs: slugs.map((slug) => `${slug}-x`) },
      ],
      services,
      "/",
    );

    expect(services.catalogue.getArtwork).toHaveBeenCalledTimes(EDITORIAL_RAIL_MAX_LOOKUPS);
  });

  it("resolves artist rails", async () => {
    const services = fakeArtServices();
    services.catalogue.getArtist.mockResolvedValue({
      slug: "flora-powers",
      name: "Flora Powers",
      discipline: "Painter",
      portraitUrl: null,
      artworkCount: 3,
      bio: null,
    });

    const vm = await composeEditorialBody(
      [{ type: "artistRail", artistSlugs: ["flora-powers"] }],
      services,
      "/",
    );

    expect(vm.rails[0]).toMatchObject({
      kind: "artists",
      cards: [{ slug: "flora-powers", href: "/artists/flora-powers" }],
    });
    expect(services.viewer.load).not.toHaveBeenCalled();
  });
});
