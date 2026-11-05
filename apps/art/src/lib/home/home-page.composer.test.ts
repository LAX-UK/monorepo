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
    });
    expect(services.favorites.savedArtworkSlugs).not.toHaveBeenCalled();
    expect(services.favorites.followedArtistSlugs).not.toHaveBeenCalled();
    expect(vm.featuredArtworks[0]).toMatchObject({ slug: "warm-basket", saved: false });
    expect(vm.featuredArtists).toMatchObject({
      layout: "feature",
      solo: { card: { href: "/artists/flora-powers" } },
    });
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

    expect(vm.featuredArtists).toMatchObject({
      solo: { card: { following: true } },
    });
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

    expect(services.catalogue.listArtworks).toHaveBeenLastCalledWith({ limit: 8 });
    expect(services.catalogue.listArtists).toHaveBeenLastCalledWith({ limit: 6 });
    expect(vm.featuredArtworks).toHaveLength(1);
    expect(vm.featuredArtists).toMatchObject({ layout: "feature" });
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

    expect(vm.sections).toEqual(["guide", "closing-cta"]);
    expect(vm.guidePromo.imageUrl).toBeNull();
  });

  it("reads the detail of a single featured artist, and keeps the feature when that read fails", async () => {
    const services = fakeArtServices();
    services.catalogue.listArtists.mockResolvedValue({ items: [artistSummary()] });
    services.catalogue.getArtist.mockRejectedValue(new Error("down"));

    const vm = await composeArtHomePage(services);

    expect(services.catalogue.getArtist).toHaveBeenCalledWith("flora-powers");
    expect(vm.featuredArtists).toMatchObject({ layout: "feature", solo: { shortBio: null } });
  });

  it("does not read artist details for a pair or a rail", async () => {
    const services = fakeArtServices();
    services.catalogue.listArtists.mockResolvedValue({
      items: ["a", "b"].map((slug) => artistSummary({ slug })),
    });

    const vm = await composeArtHomePage(services);

    expect(vm.featuredArtists).toMatchObject({ layout: "pair" });
    expect(services.catalogue.getArtist).not.toHaveBeenCalled();
  });

  it("hides a rail with fewer than three items rather than leaving its row mostly empty", async () => {
    const services = fakeArtServices();
    services.catalogue.listArtworks.mockResolvedValue({
      items: [artworkSummary({ slug: "a" }), artworkSummary({ slug: "b" })],
    });
    services.catalogue.listArtists.mockResolvedValue({
      items: ["a", "b", "c"].map((slug) => artistSummary({ slug })),
    });

    const vm = await composeArtHomePage(services);

    expect(vm.sections).not.toContain("curators-picks");
    expect(vm.sections).toContain("featured-artists");
  });

  it("keeps Curators' picks for its inline error when the catalogue fails", async () => {
    const services = fakeArtServices();
    services.catalogue.listArtworks.mockRejectedValue(new Error("down"));

    const vm = await composeArtHomePage(services);

    expect(vm.sections).toContain("curators-picks");
  });

  it("puts the guide promo on the page when the gallery team band follows it", async () => {
    const vm = await composeArtHomePage(fakeArtServices());

    expect(vm.surfaces).toEqual({ guide: "plain", "closing-cta": "band" });
  });

  it("lists every section in Figma order when all data is present", async () => {
    const services = fakeArtServices();
    services.catalogue.listArtworks.mockResolvedValue({
      items: ["a", "b", "c"].map((slug) => artworkSummary({ slug })),
    });
    services.catalogue.listArtists.mockResolvedValue({
      items: ["a", "b", "c"].map((slug) => artistSummary({ slug })),
    });
    services.editorial.home.mockResolvedValue({
      status: "ok",
      data: {
        placements: [
          placement("home_whats_on", 0),
          placement("home_stories", 0, { mediaUrl: "https://cdn.test/story.jpg" }),
        ],
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
      "product-doors",
      "stories",
      "guide",
      "galleries",
      "closing-cta",
    ]);
    expect(vm.surfaces.guide).toBe("band");
  });

  it("marks the galleries text-led when none has an image; What's on and stories never are", async () => {
    const services = fakeArtServices();
    services.editorial.listVenues.mockResolvedValue({
      status: "ok",
      data: { items: [{ slug: "marylebone", name: "Marylebone", coverUrl: null }] },
    });
    services.editorial.getVenue.mockResolvedValue({
      status: "ok",
      data: venueDetail("marylebone", { coverUrl: null }),
    });

    const vm = await composeArtHomePage(services);

    expect(vm.textLed).toEqual({ galleries: true });
  });

  it("caps What's on at two and stories at three", async () => {
    const services = fakeArtServices();
    services.editorial.home.mockResolvedValue({
      status: "ok",
      data: {
        placements: [
          ...[0, 1, 2, 3, 4].map((position) => placement("home_whats_on", position)),
          ...[0, 1, 2, 3].map((position) =>
            placement("home_stories", position, { mediaUrl: "https://cdn.test/story.jpg" }),
          ),
        ],
      },
    });

    const vm = await composeArtHomePage(services);

    expect(vm.whatsOn.map((card) => card.headline)).toEqual(["home_whats_on 0", "home_whats_on 1"]);
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

describe("composeArtHomePage promo placements", () => {
  it("dresses the LAX Bid door from home_promo_bid and keeps the directory link", async () => {
    const services = fakeArtServices();
    services.ecosystem.crossProductLinks.mockReturnValue([
      { id: "bid", label: "LAX Bid", href: "https://bid.test", current: false, external: true },
    ]);
    services.editorial.home.mockResolvedValue({
      status: "ok",
      data: {
        placements: [
          {
            slot: "home_promo_bid",
            position: 0,
            headline: "Live auctions",
            body: "Bid on works.",
            ctaLabel: "See auctions",
            mediaUrl: "https://cdn.test/bid.jpg",
            linkUrl: "https://elsewhere.test",
            refKind: "external",
            refSlug: null,
          },
        ],
      },
    });

    const vm = await composeArtHomePage(services);

    expect(vm.productDoors).toEqual([
      expect.objectContaining({
        product: "bid",
        title: "Live auctions",
        promise: "Bid on works.",
        actionLabel: "Visit LAX Bid",
        href: "https://bid.test",
        imageUrl: "https://cdn.test/bid.jpg",
      }),
    ]);
  });

  it("keeps the static copy when the editorial read is disabled", async () => {
    const services = fakeArtServices();
    services.ecosystem.crossProductLinks.mockReturnValue([
      { id: "bid", label: "LAX Bid", href: "https://bid.test", current: false, external: true },
    ]);
    services.editorial.home.mockResolvedValue({ status: "disabled" });

    const vm = await composeArtHomePage(services);

    expect(vm.productDoors[0]).toMatchObject({
      title: "Art and collectibles at auction",
      imageUrl: null,
    });
  });
});

function exhibitionSummary(slug: string, overrides: Record<string, unknown> = {}) {
  return {
    slug,
    kind: "exhibition",
    title: `Show ${slug}`,
    subtitle: null,
    summary: null,
    startsOn: "2026-10-01",
    endsOn: "2026-12-12",
    coverUrl: `https://cdn.test/${slug}.jpg`,
    featured: false,
    venue: { slug: "marylebone", name: "Marylebone" },
    ...overrides,
  };
}

function storySummary(slug: string, overrides: Record<string, unknown> = {}) {
  return {
    slug,
    kind: "article",
    title: `Story ${slug}`,
    standfirst: null,
    coverUrl: `https://cdn.test/${slug}.jpg`,
    featured: true,
    readMinutes: 3,
    ...overrides,
  };
}

describe("composeArtHomePage What's on", () => {
  it("leads with the current exhibitions: a large lead and a second card", async () => {
    const services = fakeArtServices();
    services.editorial.listExhibitions.mockResolvedValue({
      status: "ok",
      data: { items: ["a", "b", "c"].map((slug) => exhibitionSummary(slug)) },
    });

    const vm = await composeArtHomePage(services);

    expect(services.editorial.listExhibitions).toHaveBeenCalledWith("current");
    expect(vm.sections).toContain("whats-on");
    expect(vm.whatsOn).toHaveLength(2);
    expect(vm.whatsOn[0]).toMatchObject({
      kicker: "Exhibition",
      kickerDetail: "Marylebone",
      meta: "1 Oct – 12 Dec 2026",
      actions: [
        { label: "Visit", href: "/exhibitions/a" },
        { label: "See the works", href: "/exhibitions/a#works" },
      ],
    });
    expect(vm.whatsOn[1]).not.toHaveProperty("actions");
    expect(services.editorial.getExhibition).not.toHaveBeenCalled();
  });

  it("hides the section with no exhibitions", async () => {
    const vm = await composeArtHomePage(fakeArtServices());
    expect(vm.whatsOn).toEqual([]);
    expect(vm.sections).not.toContain("whats-on");
  });

  it("shows one exhibition alone", async () => {
    const services = fakeArtServices();
    services.editorial.listExhibitions.mockResolvedValue({
      status: "ok",
      data: { items: [exhibitionSummary("a")] },
    });
    const vm = await composeArtHomePage(services);
    expect(vm.whatsOn).toHaveLength(1);
    expect(vm.sections).toContain("whats-on");
  });

  it("uses the lead artwork's image for an exhibition without a cover", async () => {
    const services = fakeArtServices();
    services.editorial.listExhibitions.mockResolvedValue({
      status: "ok",
      data: { items: [exhibitionSummary("a", { coverUrl: null })] },
    });
    services.editorial.getExhibition.mockResolvedValue({
      status: "ok",
      data: {
        ...exhibitionSummary("a", { coverUrl: null }),
        artworks: [{ ...artworkSummary(), imageUrl: "https://cdn.test/work.jpg" }],
      },
    } as never);

    const vm = await composeArtHomePage(services);

    expect(services.editorial.getExhibition).toHaveBeenCalledWith("a");
    expect(vm.whatsOn[0]?.imageUrl).toBe("https://cdn.test/work.jpg");
  });

  it("keeps the card (with its image frame) when the detail read fails", async () => {
    const services = fakeArtServices();
    services.editorial.listExhibitions.mockResolvedValue({
      status: "ok",
      data: { items: [exhibitionSummary("a", { coverUrl: null })] },
    });
    services.editorial.getExhibition.mockRejectedValue(new Error("down"));

    const vm = await composeArtHomePage(services);

    expect(vm.whatsOn).toMatchObject([{ headline: "Show a", imageUrl: null }]);
  });

  it("falls back to the current exhibitions when the home read fails", async () => {
    const services = fakeArtServices();
    services.editorial.home.mockResolvedValue({ status: "error" });
    services.editorial.listExhibitions.mockResolvedValue({
      status: "ok",
      data: { items: [exhibitionSummary("a")] },
    });
    const vm = await composeArtHomePage(services);
    expect(vm.whatsOn).toHaveLength(1);
  });
});

describe("composeArtHomePage Featured stories", () => {
  it("takes a placed story's cover and reading time from the story", async () => {
    const services = fakeArtServices();
    services.editorial.home.mockResolvedValue({
      status: "ok",
      data: { placements: [placement("home_stories", 0, { refSlug: "welcome" })] },
    });
    services.editorial.listStories.mockResolvedValue({
      status: "ok",
      data: { items: [storySummary("welcome")] },
    });

    const vm = await composeArtHomePage(services);

    expect(vm.stories).toMatchObject([
      { kicker: "Story", kickerDetail: "3 min read", imageUrl: "https://cdn.test/welcome.jpg" },
    ]);
  });

  it("hides a story published without a cover, and the rail with it when nothing else is left", async () => {
    const services = fakeArtServices();
    services.editorial.home.mockResolvedValue({
      status: "ok",
      data: {
        placements: [
          placement("home_stories", 0, { refSlug: "welcome", headline: "Welcome to lax.art" }),
        ],
      },
    });
    services.editorial.listStories.mockResolvedValue({
      status: "ok",
      data: { items: [storySummary("welcome", { coverUrl: null })] },
    });

    const vm = await composeArtHomePage(services);

    expect(vm.stories).toEqual([]);
    expect(vm.sections).not.toContain("stories");
  });

  it("keeps the covered stories when another has none", async () => {
    const services = fakeArtServices();
    services.editorial.listStories.mockResolvedValue({
      status: "ok",
      data: {
        items: [storySummary("welcome", { coverUrl: null }), storySummary("studio-visit")],
      },
    });

    const vm = await composeArtHomePage(services);

    expect(vm.stories.map((card) => card.href)).toEqual(["/stories/studio-visit"]);
    expect(vm.sections).toContain("stories");
  });
});
