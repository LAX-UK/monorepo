import type {
  ArtEditorialExhibitionDetail,
  ArtEditorialExhibitionSummary,
  ArtEditorialPlacement,
} from "@/lib/editorial/art-editorial.types";
import { describe, expect, it } from "vitest";
import {
  WHATS_ON_LIMIT,
  buildWhatsOnCards,
  leadArtworkImage,
  pickWhatsOn,
  whatsOnNeedsDetail,
} from "./art-home-whats-on.vm.js";

function exhibition(
  slug: string,
  overrides: Partial<ArtEditorialExhibitionSummary> = {},
): ArtEditorialExhibitionSummary {
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

function placement(position: number, overrides: Partial<ArtEditorialPlacement> = {}) {
  return {
    slot: "home_whats_on",
    position,
    headline: null,
    mediaUrl: null,
    linkUrl: null,
    refKind: "exhibition",
    refSlug: `show-${position}`,
    ...overrides,
  } satisfies ArtEditorialPlacement;
}

function detail(
  slug: string,
  overrides: Partial<ArtEditorialExhibitionDetail> = {},
): ArtEditorialExhibitionDetail {
  return {
    ...exhibition(slug),
    timesNote: null,
    venueSlug: null,
    body: [],
    installationMedia: [],
    ...overrides,
  } as ArtEditorialExhibitionDetail;
}

describe("pickWhatsOn", () => {
  it("is empty with no placements and no current exhibitions, so the section hides", () => {
    expect(pickWhatsOn([], [])).toEqual([]);
  });

  it("shows a single exhibition alone", () => {
    expect(pickWhatsOn([], [exhibition("a")]).map((pick) => pick.slug)).toEqual(["a"]);
  });

  it("shows two, and with more keeps the first two only", () => {
    const current = ["a", "b", "c", "d"].map((slug) => exhibition(slug));
    expect(WHATS_ON_LIMIT).toBe(2);
    expect(pickWhatsOn([], current).map((pick) => pick.slug)).toEqual(["a", "b"]);
  });

  it("leads with a featured current exhibition", () => {
    const current = [exhibition("a"), exhibition("b", { featured: true })];
    expect(pickWhatsOn([], current).map((pick) => pick.slug)).toEqual(["b", "a"]);
  });

  it("follows curated placements in position order, resolving them against the current list", () => {
    const picks = pickWhatsOn(
      [placement(1, { refSlug: "b" }), placement(0, { refSlug: "a" })],
      [exhibition("a"), exhibition("b"), exhibition("c")],
    );
    expect(picks.map((pick) => pick.slug)).toEqual(["a", "b"]);
    expect(picks[0]?.exhibition?.slug).toBe("a");
  });

  it("keeps a curated exhibition that is not in the current list, to be read on its own", () => {
    const [pick] = pickWhatsOn([placement(0, { refSlug: "upcoming" })], []);
    expect(pick).toMatchObject({ slug: "upcoming", exhibition: null });
    expect(whatsOnNeedsDetail(pick as never)).toBe(true);
  });

  it("shows an exhibition once, however many placements name it", () => {
    const picks = pickWhatsOn(
      [placement(0, { refSlug: "a" }), placement(1, { refSlug: "a" })],
      [exhibition("a")],
    );
    expect(picks).toHaveLength(1);
  });

  it("keeps a curated item that is not an exhibition", () => {
    const [pick] = pickWhatsOn([placement(0, { refKind: "external", refSlug: null })], []);
    expect(pick).toMatchObject({ slug: null, exhibition: null });
    expect(whatsOnNeedsDetail(pick as never)).toBe(false);
  });
});

describe("whatsOnNeedsDetail", () => {
  it("reads the detail only when the exhibition has no image of its own", () => {
    const withCover = pickWhatsOn([], [exhibition("a")])[0];
    const withoutCover = pickWhatsOn([], [exhibition("b", { coverUrl: null })])[0];
    expect(whatsOnNeedsDetail(withCover as never)).toBe(false);
    expect(whatsOnNeedsDetail(withoutCover as never)).toBe(true);
  });

  it("does not read the detail when the placement brings its own image", () => {
    const [pick] = pickWhatsOn(
      [placement(0, { refSlug: "b", mediaUrl: "https://cdn.test/curated.jpg" })],
      [exhibition("b", { coverUrl: null })],
    );
    expect(whatsOnNeedsDetail(pick as never)).toBe(false);
  });
});

describe("leadArtworkImage", () => {
  it("takes the first work that has an image", () => {
    const works = [{ imageUrl: null }, { imageUrl: " " }, { imageUrl: "https://cdn.test/w.jpg" }];
    expect(leadArtworkImage({ artworks: works } as never)).toBe("https://cdn.test/w.jpg");
  });

  it("is null without works", () => {
    expect(leadArtworkImage(detail("a"))).toBeNull();
    expect(leadArtworkImage(null)).toBeNull();
  });
});

describe("buildWhatsOnCards", () => {
  it("builds the lead with the gallery eyebrow, dates and the two actions", () => {
    const [lead] = buildWhatsOnCards(pickWhatsOn([], [exhibition("a")]));
    expect(lead).toEqual({
      key: "a",
      href: "/exhibitions/a",
      headline: "Show a",
      kicker: "Exhibition",
      kickerDetail: "Marylebone",
      meta: "1 Oct – 12 Dec 2026",
      imageUrl: "https://cdn.test/a.jpg",
      actions: [
        { label: "Visit", href: "/exhibitions/a" },
        { label: "See the works", href: "/exhibitions/a#works" },
      ],
    });
  });

  it("gives the second exhibition no actions: the whole card links", () => {
    const cards = buildWhatsOnCards(pickWhatsOn([], [exhibition("a"), exhibition("b")]));
    expect(cards).toHaveLength(2);
    expect(cards[1]).toMatchObject({ href: "/exhibitions/b", imageUrl: "https://cdn.test/b.jpg" });
    expect(cards[1]).not.toHaveProperty("actions");
  });

  it("falls back to the lead artwork when the exhibition has no cover", () => {
    const picks = pickWhatsOn([], [exhibition("a", { coverUrl: null })]);
    const withWorks = detail("a", {
      coverUrl: null,
      artworks: [{ imageUrl: "https://cdn.test/work.jpg" }],
    } as never);
    const [card] = buildWhatsOnCards(picks, new Map([["a", withWorks]]));
    expect(card?.imageUrl).toBe("https://cdn.test/work.jpg");
  });

  it("keeps an image frame (null image, never text-only) when nothing has an image", () => {
    const picks = pickWhatsOn([], [exhibition("a", { coverUrl: null })]);
    const [card] = buildWhatsOnCards(picks, new Map([["a", detail("a", { coverUrl: null })]]));
    expect(card).toMatchObject({ headline: "Show a", imageUrl: null });
  });

  it("prefers a curated image over the cover, and a curated headline over the title", () => {
    const picks = pickWhatsOn(
      [placement(0, { refSlug: "a", headline: " Autumn ", mediaUrl: "https://cdn.test/c.jpg" })],
      [exhibition("a")],
    );
    expect(buildWhatsOnCards(picks)[0]).toMatchObject({
      key: "home_whats_on-0",
      headline: "Autumn",
      imageUrl: "https://cdn.test/c.jpg",
    });
  });

  it("takes the gallery and dates from the detail of an exhibition outside the current list", () => {
    const picks = pickWhatsOn([placement(0, { refSlug: "next" })], []);
    const [card] = buildWhatsOnCards(picks, new Map([["next", detail("next")]]));
    expect(card).toMatchObject({
      headline: "Show next",
      kickerDetail: "Marylebone",
      meta: "1 Oct – 12 Dec 2026",
      imageUrl: "https://cdn.test/next.jpg",
    });
  });

  it("omits the gallery when the exhibition has no venue, and 'See the works' for a non-exhibition", () => {
    const [noVenue] = buildWhatsOnCards(pickWhatsOn([], [exhibition("a", { venue: null })]));
    expect(noVenue?.kickerDetail).toBeNull();
    const [external] = buildWhatsOnCards(
      pickWhatsOn(
        [
          placement(0, {
            refKind: "external",
            refSlug: null,
            linkUrl: "/visit",
            headline: "Visit",
          }),
        ],
        [],
      ),
    );
    expect(external?.actions).toEqual([{ label: "Visit", href: "/visit" }]);
  });

  it("drops an exhibition whose detail could not be read and that has no title", () => {
    expect(buildWhatsOnCards(pickWhatsOn([placement(0, { refSlug: "gone" })], []))).toEqual([]);
  });
});
