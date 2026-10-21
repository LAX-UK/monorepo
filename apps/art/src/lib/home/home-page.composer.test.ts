import {
  SIGNED_IN_VIEWER,
  artistSummary,
  artworkSummary,
  fakeArtServices,
} from "@/lib/testing/fake-art-services";
import { describe, expect, it } from "vitest";
import { composeArtHomePage } from "./home-page.composer.js";

describe("composeArtHomePage", () => {
  it("requests featured originals and artists for guests without a favorites read", async () => {
    const services = fakeArtServices();
    services.catalogue.listArtworks.mockResolvedValue({ items: [artworkSummary()] });
    services.catalogue.listArtists.mockResolvedValue({ items: [artistSummary()] });

    const vm = await composeArtHomePage(services);

    expect(services.catalogue.listArtworks).toHaveBeenCalledWith({
      limit: 8,
      placement: "featured_originals",
      type: "original",
    });
    expect(services.favorites.savedArtworkSlugs).not.toHaveBeenCalled();
    expect(services.favorites.followedArtistSlugs).not.toHaveBeenCalled();
    expect(vm.featuredArtworks[0]).toMatchObject({ slug: "warm-basket", saved: false });
    expect(vm.featuredArtists[0]).toMatchObject({ href: "/artists/flora-powers" });
    expect(vm.favoriteAuth).toEqual({ signedIn: false, loginHref: "/login?returnTo=%2F" });
    expect(vm.sectionErrors).toEqual([]);
  });

  it("marks saved works for signed-in viewers", async () => {
    const services = fakeArtServices(SIGNED_IN_VIEWER);
    services.catalogue.listArtworks.mockResolvedValue({ items: [artworkSummary()] });
    services.favorites.savedArtworkSlugs.mockResolvedValue(new Set(["warm-basket"]));

    const vm = await composeArtHomePage(services);

    expect(vm.featuredArtworks[0]?.saved).toBe(true);
    expect(vm.favoriteAuth.signedIn).toBe(true);
  });

  it("marks followed featured artists from one read for signed-in viewers", async () => {
    const services = fakeArtServices(SIGNED_IN_VIEWER);
    services.catalogue.listArtists.mockResolvedValue({ items: [artistSummary()] });
    services.favorites.followedArtistSlugs.mockResolvedValue(new Set(["flora-powers"]));

    const vm = await composeArtHomePage(services);

    expect(vm.featuredArtists[0]?.following).toBe(true);
    expect(services.favorites.followedArtistSlugs).toHaveBeenCalledTimes(1);
  });

  it("degrades per section when the catalogue fails", async () => {
    const services = fakeArtServices();
    services.catalogue.listArtworks.mockRejectedValue(new Error("down"));

    const vm = await composeArtHomePage(services);

    expect(vm.featuredArtworks).toEqual([]);
    expect(vm.sectionErrors).toEqual(["artworks"]);
  });

  it("falls back to the newest Art items when Shop-curated placements hold none", async () => {
    const services = fakeArtServices();
    services.catalogue.listArtworks
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ items: [artworkSummary()] });
    services.catalogue.listArtists
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ items: [artistSummary()] });

    const vm = await composeArtHomePage(services);

    expect(services.catalogue.listArtworks).toHaveBeenLastCalledWith({
      limit: 8,
      type: "original",
    });
    expect(services.catalogue.listArtists).toHaveBeenLastCalledWith({ limit: 6 });
    expect(vm.featuredArtworks).toHaveLength(1);
    expect(vm.featuredArtists).toHaveLength(1);
  });
});

function placement(
  slot: "home_hero" | "home_whats_on" | "home_stories" | "home_guide",
  position: number,
  overrides: Record<string, unknown> = {},
) {
  return {
    slot,
    position,
    headline: `${slot} ${position}`,
    mediaUrl: null,
    linkUrl: null,
    refKind: "story",
    refSlug: `${slot}-${position}`,
    ...overrides,
  };
}

function venueDetail(slug: string, overrides: Record<string, unknown> = {}) {
  return {
    slug,
    name: slug === "marylebone" ? "Marylebone" : "Soho",
    address: "156 New Cavendish Street",
    postcode: "London W1W 6YW",
    openingHours: null,
    phone: null,
    email: null,
    mapUrl: null,
    coverUrl: "https://cdn.test/venue.jpg",
    body: [],
    ...overrides,
  };
}

describe("composeArtHomePage sections", () => {
  it("keeps only static and catalogue sections when editorial, venues and products are empty", async () => {
    const vm = await composeArtHomePage(fakeArtServices());

    expect(vm.sections).toEqual(["curators-picks", "guide", "closing-cta"]);
    expect(vm.guidePromo.imageUrl).toBeNull();
  });

  it("lists every section in Figma order when all data is present", async () => {
    const services = fakeArtServices();
    services.catalogue.listArtists.mockResolvedValue({ items: [artistSummary()] });
    services.editorial.home.mockResolvedValue({
      status: "ok",
      data: {
        placements: [placement("home_whats_on", 0), placement("home_stories", 0)],
      },
    });
    services.editorial.listVenues.mockResolvedValue({
      status: "ok",
      data: { items: [{ slug: "marylebone", name: "Marylebone", coverUrl: null }] },
    });
    services.editorial.getVenue.mockResolvedValue({
      status: "ok",
      data: venueDetail("marylebone"),
    });
    services.ecosystem.crossProductLinks.mockReturnValue([
      { id: "bid", label: "LAX.bid", href: "https://bid.test", current: false, external: true },
    ]);

    const vm = await composeArtHomePage(services);

    expect(vm.sections).toEqual([
      "whats-on",
      "curators-picks",
      "featured-artists",
      "ecosystem",
      "stories",
      "guide",
      "galleries",
      "closing-cta",
    ]);
  });

  it("caps What's on at a lead plus three and stories at a lead plus two", async () => {
    const services = fakeArtServices();
    services.editorial.home.mockResolvedValue({
      status: "ok",
      data: {
        placements: [
          ...[0, 1, 2, 3, 4].map((position) => placement("home_whats_on", position)),
          ...[0, 1, 2, 3].map((position) => placement("home_stories", position)),
        ],
      },
    });

    const vm = await composeArtHomePage(services);

    expect(vm.whatsOn.map((card) => card.headline)).toEqual([
      "home_whats_on 0",
      "home_whats_on 1",
      "home_whats_on 2",
      "home_whats_on 3",
    ]);
    expect(vm.stories).toHaveLength(3);
  });

  it("maps venues to gallery cards with street and postcode lines", async () => {
    const services = fakeArtServices();
    services.editorial.listVenues.mockResolvedValue({
      status: "ok",
      data: {
        items: [
          { slug: "marylebone", name: "Marylebone", coverUrl: "https://cdn.test/venue.jpg" },
          { slug: "soho", name: "Soho", coverUrl: null },
        ],
      },
    });
    services.editorial.getVenue.mockImplementation(async (slug: string) => ({
      status: "ok",
      data:
        slug === "soho"
          ? venueDetail("soho", { address: "13 Soho Square", postcode: null, coverUrl: null })
          : venueDetail("marylebone"),
    }));

    const vm = await composeArtHomePage(services);

    expect(vm.galleries).toEqual([
      {
        key: "marylebone",
        href: "/visit/marylebone",
        name: "Marylebone",
        addressLines: ["156 New Cavendish Street", "London W1W 6YW"],
        imageUrl: "https://cdn.test/venue.jpg",
      },
      {
        key: "soho",
        href: "/visit/soho",
        name: "Soho",
        addressLines: ["13 Soho Square"],
        imageUrl: null,
      },
    ]);
  });

  it("keeps a gallery card without address lines when its detail read fails", async () => {
    const services = fakeArtServices();
    services.editorial.listVenues.mockResolvedValue({
      status: "ok",
      data: { items: [{ slug: "marylebone", name: "Marylebone", coverUrl: null }] },
    });
    services.editorial.getVenue.mockResolvedValue({ status: "error" });

    const vm = await composeArtHomePage(services);

    expect(vm.galleries).toEqual([
      {
        key: "marylebone",
        href: "/visit/marylebone",
        name: "Marylebone",
        addressLines: [],
        imageUrl: null,
      },
    ]);
  });

  it("reads details for at most two venues", async () => {
    const services = fakeArtServices();
    services.editorial.listVenues.mockResolvedValue({
      status: "ok",
      data: {
        items: ["a", "b", "c"].map((slug) => ({ slug, name: slug, coverUrl: null })),
      },
    });
    services.editorial.getVenue.mockResolvedValue({
      status: "ok",
      data: venueDetail("marylebone"),
    });

    const vm = await composeArtHomePage(services);

    expect(vm.galleries.map((gallery) => gallery.key)).toEqual(["a", "b"]);
    expect(services.editorial.getVenue).toHaveBeenCalledTimes(2);
  });

  it("hides galleries when the venue read fails", async () => {
    const services = fakeArtServices();
    services.editorial.listVenues.mockResolvedValue({ status: "error" });

    const vm = await composeArtHomePage(services);

    expect(vm.galleries).toEqual([]);
    expect(vm.sections).not.toContain("galleries");
  });

  it("dresses the guide promo with the first home_guide placement image", async () => {
    const services = fakeArtServices();
    services.editorial.home.mockResolvedValue({
      status: "ok",
      data: {
        placements: [
          placement("home_guide", 0),
          placement("home_guide", 1, { mediaUrl: "https://cdn.test/guide.jpg" }),
        ],
      },
    });

    const vm = await composeArtHomePage(services);

    expect(vm.guidePromo).toMatchObject({
      imageUrl: "https://cdn.test/guide.jpg",
      cta: { href: "/collector-hub/101-guide", label: "Explore the guide" },
    });
  });

  it("passes the viewer through for the closing enquiry", async () => {
    const vm = await composeArtHomePage(fakeArtServices(SIGNED_IN_VIEWER));

    expect(vm.viewer).toEqual(SIGNED_IN_VIEWER);
  });
});

describe("composeArtHomePage editorial", () => {
  it("maps placements to hero and section cards", async () => {
    const services = fakeArtServices();
    services.editorial.home.mockResolvedValue({
      status: "ok",
      data: {
        placements: [
          {
            slot: "home_hero",
            position: 0,
            headline: "Summer show",
            mediaUrl: "https://cdn.test/hero.jpg",
            linkUrl: null,
            refKind: "exhibition",
            refSlug: "summer-show",
          },
          {
            slot: "home_whats_on",
            position: 0,
            headline: null,
            mediaUrl: null,
            linkUrl: "/visit",
            refKind: "external",
            refSlug: null,
          },
        ],
      },
    });

    const vm = await composeArtHomePage(services);

    expect(vm.hero).toMatchObject({ headline: "Summer show", href: "/exhibitions/summer-show" });
    expect(vm.whatsOn).toMatchObject([{ headline: "What's on", href: "/visit" }]);
    expect(vm.stories).toEqual([]);
  });

  it("hides editorial sections when editorial is disabled or fails", async () => {
    const services = fakeArtServices();
    const disabled = await composeArtHomePage(services);
    services.editorial.home.mockResolvedValue({ status: "error" });
    const failed = await composeArtHomePage(services);

    for (const vm of [disabled, failed]) {
      expect(vm.hero).toBeNull();
      expect(vm.sections).not.toContain("whats-on");
      expect(vm.sections).not.toContain("stories");
    }
  });
});
