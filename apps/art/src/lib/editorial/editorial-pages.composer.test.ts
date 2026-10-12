import type {
  ArtEditorialExhibitionDetail,
  ArtEditorialVenueDetail,
} from "@/lib/editorial/art-editorial.types";
import { fakeArtServices } from "@/lib/testing/fake-art-services";
import { describe, expect, it } from "vitest";
import {
  composeArtHubPage,
  composeExhibitionDetailPage,
  composeVisitPage,
  parseExhibitionStatus,
  presentOpeningHours,
} from "./editorial-pages.composer.js";

function exhibition(
  overrides: Partial<ArtEditorialExhibitionDetail> = {},
): ArtEditorialExhibitionDetail {
  return {
    slug: "summer-show",
    kind: "exhibition",
    title: "Summer show",
    summary: null,
    startsOn: "2026-06-01",
    endsOn: "2026-08-30",
    coverUrl: null,
    featured: false,
    timesNote: null,
    venueSlug: "mayfair",
    body: [],
    installationMedia: [],
    ...overrides,
  };
}

function venue(overrides: Partial<ArtEditorialVenueDetail> = {}): ArtEditorialVenueDetail {
  return {
    slug: "mayfair",
    name: "LAX Mayfair",
    address: "1 Bond Street",
    postcode: "W1",
    openingHours: { "Tue – Sat": "10:00 – 18:00" },
    phone: null,
    email: null,
    mapUrl: null,
    coverUrl: null,
    body: [],
    ...overrides,
  };
}

describe("presentOpeningHours", () => {
  it("accepts maps, row lists and plain strings, skipping junk", () => {
    expect(presentOpeningHours({ "Tue – Sat": "10–6", Sun: 3 })).toEqual([
      { label: "Tue – Sat", value: "10–6" },
    ]);
    expect(presentOpeningHours([{ label: "Mon", hours: "Closed" }, { label: "" }, null])).toEqual([
      { label: "Mon", value: "Closed" },
    ]);
    expect(presentOpeningHours(" By appointment ")).toEqual([
      { label: "Opening hours", value: "By appointment" },
    ]);
    expect(presentOpeningHours(null)).toEqual([]);
  });

  it("orders map-form hours by weekday because jsonb drops key order", () => {
    expect(
      presentOpeningHours({ Mon: "Closed", Sun: "12–5", "Tue – Sat": "10–6", Holidays: "Varies" }),
    ).toEqual([
      { label: "Mon", value: "Closed" },
      { label: "Tue – Sat", value: "10–6" },
      { label: "Sun", value: "12–5" },
      { label: "Holidays", value: "Varies" },
    ]);
  });
});

describe("parseExhibitionStatus", () => {
  it("defaults unknown values to current", () => {
    expect(parseExhibitionStatus("past")).toBe("past");
    expect(parseExhibitionStatus(["upcoming"])).toBe("upcoming");
    expect(parseExhibitionStatus("drop table")).toBe("current");
  });
});

describe("composeExhibitionDetailPage", () => {
  it("joins venue name and hours, preferring the exhibition times note", async () => {
    const services = fakeArtServices();
    services.editorial.getExhibition.mockResolvedValue({ status: "ok", data: exhibition() });
    services.editorial.getVenue.mockResolvedValue({ status: "ok", data: venue() });

    const result = await composeExhibitionDetailPage(services, "summer-show");
    expect(result).toMatchObject({
      status: "ok",
      data: {
        dateLabel: "1 Jun – 30 Aug 2026",
        venueName: "LAX Mayfair",
        hoursLabel: "Tue – Sat 10:00 – 18:00",
      },
    });

    services.editorial.getExhibition.mockResolvedValue({
      status: "ok",
      data: exhibition({ timesNote: "Late opening Thursdays" }),
    });
    const withNote = await composeExhibitionDetailPage(services, "summer-show");
    expect(withNote.status === "ok" && withNote.data.hoursLabel).toBe("Late opening Thursdays");
  });

  it("passes through not found and tolerates a missing venue", async () => {
    const services = fakeArtServices();
    services.editorial.getExhibition.mockResolvedValue({ status: "not_found" });
    expect(await composeExhibitionDetailPage(services, "x")).toEqual({ status: "not_found" });

    services.editorial.getExhibition.mockResolvedValue({ status: "ok", data: exhibition() });
    services.editorial.getVenue.mockResolvedValue({ status: "not_found" });
    const result = await composeExhibitionDetailPage(services, "summer-show");
    expect(result.status === "ok" && result.data.venueName).toBeNull();
  });
});

describe("composeVisitPage", () => {
  it("loads every venue detail and reports error only when all details fail", async () => {
    const services = fakeArtServices();
    services.editorial.listVenues.mockResolvedValue({
      status: "ok",
      data: { items: [{ slug: "mayfair", name: "LAX Mayfair", coverUrl: null }] },
    });
    services.editorial.getVenue.mockResolvedValue({ status: "ok", data: venue() });
    const ok = await composeVisitPage(services);
    expect(ok.status === "ok" && ok.data.venues[0]?.hours).toEqual([
      { label: "Tue – Sat", value: "10:00 – 18:00" },
    ]);

    services.editorial.getVenue.mockResolvedValue({ status: "error" });
    expect(await composeVisitPage(services)).toEqual({ status: "error" });
  });
});

describe("composeArtHubPage", () => {
  it("renders stories even when placements fail", async () => {
    const services = fakeArtServices();
    services.editorial.home.mockResolvedValue({ status: "error" });
    services.editorial.listStories.mockResolvedValue({
      status: "ok",
      data: {
        items: [
          {
            slug: "studio",
            kind: "guide",
            title: "Studio guide",
            standfirst: null,
            coverUrl: null,
            featured: false,
          },
        ],
      },
    });
    const result = await composeArtHubPage(services);
    expect(result).toMatchObject({
      status: "ok",
      data: { spotlight: [], stories: [{ href: "/stories/studio", kicker: "Guide" }] },
    });
  });
});
