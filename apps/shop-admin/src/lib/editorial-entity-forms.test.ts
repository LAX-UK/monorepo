import type { EditorialBlock } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  buildExhibitionPayload,
  buildPagePayload,
  buildStoryPayload,
  buildVenuePayload,
  emptyExhibitionForm,
  emptyStoryForm,
  emptyVenueForm,
  exhibitionFormFromDetail,
  venueFormFromDetail,
} from "./editorial-entity-forms";

const VENUE_ID = "3f2b8c1e-5d4a-4b6c-9e8f-1a2b3c4d5e6f";
const blocks: EditorialBlock[] = [{ type: "heading", level: 2, text: "Hello" }];

describe("buildPagePayload", () => {
  it("trims fields and passes blocks through", () => {
    expect(buildPagePayload({ slug: " how-to-buy ", title: " How " }, blocks)).toEqual({
      ok: true,
      payload: { slug: "how-to-buy", title: "How", body: blocks },
    });
  });

  it("collects form and block errors together", () => {
    const result = buildPagePayload({ slug: "Bad Slug", title: "" }, [{ type: "quote", text: "" }]);
    expect(result).toEqual({
      ok: false,
      errors: [
        "Slug must be lowercase letters and numbers separated by single hyphens.",
        "Title is required.",
        "Block 1 (Quote): quote text is required.",
      ],
    });
  });
});

describe("venue form", () => {
  it("sends blanks as null and parses opening hours JSON", () => {
    const result = buildVenuePayload(
      {
        ...emptyVenueForm(),
        slug: "mayfair",
        name: "Mayfair",
        openingHoursJson: '{"mon":"10-6"}',
        coverMediaKey: "venues/a.jpg",
      },
      [],
    );
    expect(result).toEqual({
      ok: true,
      payload: {
        slug: "mayfair",
        name: "Mayfair",
        address: null,
        postcode: null,
        openingHours: { mon: "10-6" },
        phone: null,
        email: null,
        mapUrl: null,
        coverMediaKey: "venues/a.jpg",
        body: [],
      },
    });
  });

  it("rejects bad email, non-https map URL and invalid opening hours JSON", () => {
    const result = buildVenuePayload(
      {
        ...emptyVenueForm(),
        slug: "mayfair",
        name: "Mayfair",
        email: "nope",
        mapUrl: "http://maps",
        openingHoursJson: "{",
      },
      [],
    );
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors).toHaveLength(3);
  });

  it("round-trips opening hours from the API detail", () => {
    const form = venueFormFromDetail({
      id: VENUE_ID,
      slug: "mayfair",
      status: "draft",
      label: "Mayfair",
      name: "Mayfair",
      address: null,
      postcode: null,
      openingHours: { mon: "10-6" },
      phone: null,
      email: null,
      mapUrl: null,
      coverMediaKey: null,
      body: [],
    });
    expect(JSON.parse(form.openingHoursJson)).toEqual({ mon: "10-6" });
  });
});

describe("buildStoryPayload", () => {
  it("requires an https video URL when one is given", () => {
    const result = buildStoryPayload(
      { ...emptyStoryForm(), slug: "s", title: "T", videoUrl: "youtube.com/x" },
      [],
    );
    expect(result).toEqual({ ok: false, errors: ["Video URL must start with https://."] });
  });
});

describe("exhibition form", () => {
  const base = { ...emptyExhibitionForm(), slug: "summer", title: "Summer" };

  it("builds a payload with venue and dates", () => {
    const result = buildExhibitionPayload(
      { ...base, venueId: VENUE_ID, startsOn: "2026-06-01", endsOn: "2026-06-30" },
      [],
    );
    expect(result.ok && result.payload).toMatchObject({
      venueId: VENUE_ID,
      startsOn: "2026-06-01",
      endsOn: "2026-06-30",
      summary: null,
      featured: false,
    });
  });

  it("rejects impossible dates and an end before the start", () => {
    expect(buildExhibitionPayload({ ...base, startsOn: "2026-02-30" }, [])).toEqual({
      ok: false,
      errors: ["Start date must be YYYY-MM-DD."],
    });
    expect(
      buildExhibitionPayload({ ...base, startsOn: "2026-06-02", endsOn: "2026-06-01" }, []),
    ).toEqual({ ok: false, errors: ["End date cannot be before the start date."] });
  });

  it("maps a null venue and timestamp dates from the API detail", () => {
    const form = exhibitionFormFromDetail({
      id: VENUE_ID,
      slug: "summer",
      status: "published",
      label: "Summer",
      kind: "event",
      title: "Summer",
      summary: null,
      venueId: null,
      startsOn: "2026-06-01T00:00:00.000Z",
      endsOn: null,
      timesNote: null,
      coverMediaKey: null,
      featured: true,
      body: [],
    });
    expect(form).toMatchObject({ venueId: "", startsOn: "2026-06-01", endsOn: "", kind: "event" });
  });
});
