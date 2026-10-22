import type { EditorialBlock } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  type ExhibitionDetail,
  type StoryDetail,
  type VenueDetail,
  buildExhibitionPayload,
  buildPagePayload,
  buildStoryPayload,
  buildVenuePayload,
  emptyExhibitionForm,
  emptyStoryForm,
  emptyVenueForm,
  exhibitionFormFromDetail,
  storyFormFromDetail,
  venueFormFromDetail,
} from "./editorial-entity-forms";
import { emptyWeek } from "./editorial-opening-hours";

const VENUE_ID = "3f2b8c1e-5d4a-4b6c-9e8f-1a2b3c4d5e6f";
const UPDATED_AT = "2026-03-01T10:00:00.000Z";
const blocks: EditorialBlock[] = [{ type: "heading", level: 2, text: "Hello" }];

const noSeo = { seoTitle: "", seoDescription: "" };

describe("buildPagePayload", () => {
  it("trims fields, passes blocks through and sends blank SEO as null", () => {
    expect(buildPagePayload({ slug: " how-to-buy ", title: " How ", ...noSeo }, blocks)).toEqual({
      ok: true,
      payload: {
        slug: "how-to-buy",
        title: "How",
        body: blocks,
        seoTitle: null,
        seoDescription: null,
      },
    });
  });

  it("trims SEO overrides and rejects an over-long SEO title", () => {
    const ok = buildPagePayload(
      { slug: "faq", title: "FAQ", seoTitle: "  FAQ | LAX Art ", seoDescription: " Answers. " },
      blocks,
    );
    expect(ok.ok && ok.payload).toMatchObject({
      seoTitle: "FAQ | LAX Art",
      seoDescription: "Answers.",
    });
    const tooLong = buildPagePayload(
      { slug: "faq", title: "FAQ", seoTitle: "x".repeat(121), seoDescription: "" },
      blocks,
    );
    expect(tooLong).toEqual({
      ok: false,
      errors: { seoTitle: "SEO title must be 120 characters or fewer." },
    });
  });

  it("reports each problem against its own field, blocks included", () => {
    const result = buildPagePayload({ slug: "Bad Slug", title: "", ...noSeo }, [
      { type: "quote", text: "" },
    ]);
    expect(result).toEqual({
      ok: false,
      errors: {
        slug: "Slug must be lowercase letters and numbers separated by single hyphens (120 characters at most).",
        title: "Enter a title.",
        "block-1": "Block 1 (Quote): quote text is required.",
      },
    });
  });
});

describe("venue form", () => {
  const base = { ...emptyVenueForm(), slug: "mayfair", name: "Mayfair" };

  it("sends blanks as null and writes no opening hours when none are listed", () => {
    const result = buildVenuePayload({ ...base, coverMediaKey: "venues/a.jpg" }, []);
    expect(result).toEqual({
      ok: true,
      payload: {
        slug: "mayfair",
        name: "Mayfair",
        address: null,
        postcode: null,
        streetLine: null,
        city: null,
        latitude: null,
        longitude: null,
        openingHours: null,
        phone: null,
        email: null,
        mapUrl: null,
        coverMediaKey: "venues/a.jpg",
        body: [],
      },
    });
  });

  it("writes the weekly hours as the list of rows lax.art reads", () => {
    const days = emptyWeek();
    for (const index of [0, 1]) days[index] = { state: "open", opens: "10:00", closes: "18:00" };
    days[6] = { state: "closed", opens: "", closes: "" };
    const result = buildVenuePayload({ ...base, openingHours: { mode: "days", days } }, []);
    expect(result.ok && result.payload.openingHours).toEqual([
      { label: "Mon – Tue", hours: "10:00 – 18:00" },
      { label: "Sun", hours: "Closed" },
    ]);
  });

  it("parses the address, coordinates and city", () => {
    const result = buildVenuePayload(
      {
        ...base,
        streetLine: " 12 Example Mews ",
        city: "London",
        latitude: "51.5203",
        longitude: "-0.1532",
      },
      [],
    );
    expect(result.ok && result.payload).toMatchObject({
      streetLine: "12 Example Mews",
      city: "London",
      latitude: 51.5203,
      longitude: -0.1532,
    });
  });

  it("rejects bad email, non-https map URL, out of range or lone coordinates and open days without times", () => {
    const days = emptyWeek();
    days[2] = { state: "open", opens: "", closes: "" };
    const result = buildVenuePayload(
      {
        ...base,
        email: "nope",
        mapUrl: "http://maps",
        latitude: "95",
        longitude: "",
        openingHours: { mode: "days", days },
      },
      [],
    );
    expect(!result.ok && Object.keys(result.errors).sort()).toEqual([
      "email",
      "latitude",
      "mapUrl",
      "openingHours",
    ]);
    const lone = buildVenuePayload({ ...base, latitude: "51.5" }, []);
    expect(!lone.ok && lone.errors.longitude).toBe(
      "Enter both latitude and longitude, or neither.",
    );
  });

  it("keeps stored hours it cannot show until staff replace them", () => {
    const stored = "By appointment only";
    const form = venueFormFromDetail({ ...venueDetail, openingHours: stored });
    expect(form.openingHours).toEqual({ mode: "unrecognised", stored });
    const result = buildVenuePayload(form, []);
    expect(result.ok && result.payload.openingHours).toBe(stored);
  });

  const venueDetail: VenueDetail = {
    id: VENUE_ID,
    slug: "mayfair",
    status: "draft",
    label: "Mayfair",
    updatedAt: UPDATED_AT,
    name: "Mayfair",
    address: null,
    postcode: null,
    streetLine: "12 Example Mews",
    city: "London",
    latitude: 51.5203,
    longitude: -0.1532,
    openingHours: [{ label: "Tue – Sat", hours: "10:00 – 18:00" }],
    phone: null,
    email: null,
    mapUrl: null,
    coverMediaKey: null,
    body: [],
  };

  it("round-trips the location and hours from the API detail", () => {
    const form = venueFormFromDetail(venueDetail);
    expect(form).toMatchObject({
      streetLine: "12 Example Mews",
      city: "London",
      latitude: "51.5203",
    });
    const result = buildVenuePayload(form, []);
    expect(result.ok && result.payload.openingHours).toEqual([
      { label: "Tue – Sat", hours: "10:00 – 18:00" },
    ]);
  });
});

describe("story form", () => {
  const base = { ...emptyStoryForm(), slug: "s", title: "T" };

  const storyDetail: StoryDetail = {
    id: VENUE_ID,
    slug: "studio-light",
    status: "published",
    label: "Studio light",
    updatedAt: UPDATED_AT,
    kind: "podcast",
    category: null,
    title: "Studio light",
    standfirst: null,
    coverMediaKey: null,
    videoUrl: null,
    featured: false,
    authorName: "Clara Hutchins",
    readMinutes: null,
    series: "In the studio",
    episodeNumber: 4,
    audioUrl: "https://media.lax.art/podcast/studio-light.mp3",
    durationSeconds: 2778,
    publicationName: null,
    externalUrl: null,
    body: [],
  };

  it("requires an https video URL when one is given", () => {
    const result = buildStoryPayload({ ...base, videoUrl: "youtube.com/x" }, []);
    expect(result).toEqual({
      ok: false,
      errors: { videoUrl: "Video URL must start with https://." },
    });
  });

  it("builds a podcast with its episode fields", () => {
    const form = { ...base, kind: "podcast" as const };
    const result = buildStoryPayload(
      {
        ...form,
        category: "podcast",
        series: " In the studio ",
        episodeNumber: "4",
        audioUrl: "https://media.lax.art/podcast/ep4.mp3",
        duration: "46:18",
        authorName: "Clara",
      },
      [],
    );
    expect(result.ok && result.payload).toMatchObject({
      kind: "podcast",
      category: "podcast",
      series: "In the studio",
      episodeNumber: 4,
      audioUrl: "https://media.lax.art/podcast/ep4.mp3",
      durationSeconds: 2778,
      authorName: "Clara",
      readMinutes: null,
    });
  });

  it("sends a blank category so the kind's default applies", () => {
    const result = buildStoryPayload(base, []);
    expect(result.ok && result.payload.category).toBeNull();
  });

  it("rejects values outside what the API accepts, each against its field", () => {
    const result = buildStoryPayload(
      {
        ...base,
        kind: "podcast",
        episodeNumber: "0",
        audioUrl: "http://insecure.example/ep.mp3",
        duration: "soon",
      },
      [],
    );
    expect(result).toEqual({
      ok: false,
      errors: {
        episodeNumber: "Episode number must be a whole number from 1.",
        audioUrl: "Audio URL must start with https://.",
        duration: "Enter the duration as mm:ss or h:mm:ss, for example 46:18.",
      },
    });
    const article = buildStoryPayload({ ...base, readMinutes: "700" }, []);
    expect(!article.ok && article.errors.readMinutes).toMatch(/1 to 600/);
  });

  it("drops the fields a new kind does not use, but keeps them when the kind is unchanged", () => {
    const loaded = storyFormFromDetail(storyDetail);
    expect(loaded.duration).toBe("46:18");

    const unchanged = buildStoryPayload(loaded, []);
    expect(unchanged.ok && unchanged.payload).toMatchObject({
      series: "In the studio",
      audioUrl: "https://media.lax.art/podcast/studio-light.mp3",
    });

    const switched = buildStoryPayload({ ...loaded, kind: "press" }, []);
    expect(switched.ok && switched.payload).toMatchObject({
      kind: "press",
      series: null,
      episodeNumber: null,
      audioUrl: null,
      durationSeconds: null,
    });
  });
});

describe("exhibition form", () => {
  const base = { ...emptyExhibitionForm(), slug: "summer", title: "Summer" };

  const exhibitionDetail: ExhibitionDetail = {
    id: VENUE_ID,
    slug: "summer",
    status: "published",
    label: "Summer",
    updatedAt: UPDATED_AT,
    kind: "event",
    title: "Summer",
    subtitle: "A group show",
    summary: null,
    venueId: null,
    startsOn: "2026-06-01T00:00:00.000Z",
    endsOn: null,
    timesNote: null,
    coverMediaKey: null,
    featured: true,
    contactName: "Imogen Park",
    contactRole: "Gallery manager",
    contactEmail: "imogen@example.com",
    contactPhone: null,
    contactAvatarMediaKey: "shop/editorial-inline/imogen.jpg",
    body: [],
  };

  it("builds a payload with venue, dates and contact", () => {
    const result = buildExhibitionPayload(
      {
        ...base,
        venueId: VENUE_ID,
        startsOn: "2026-06-01",
        endsOn: "2026-06-30",
        subtitle: " A group show ",
        contactName: "Imogen Park",
        contactEmail: "imogen@example.com",
      },
      [],
    );
    expect(result.ok && result.payload).toMatchObject({
      venueId: VENUE_ID,
      startsOn: "2026-06-01",
      endsOn: "2026-06-30",
      subtitle: "A group show",
      contactName: "Imogen Park",
      contactEmail: "imogen@example.com",
      contactRole: null,
      summary: null,
      featured: false,
    });
  });

  it("rejects impossible dates, an end before the start and a bad contact email", () => {
    expect(buildExhibitionPayload({ ...base, startsOn: "2026-02-30" }, [])).toEqual({
      ok: false,
      errors: { startsOn: "Start date must be YYYY-MM-DD." },
    });
    expect(
      buildExhibitionPayload({ ...base, startsOn: "2026-06-02", endsOn: "2026-06-01" }, []),
    ).toEqual({ ok: false, errors: { endsOn: "End date cannot be before the start date." } });
    const result = buildExhibitionPayload({ ...base, contactEmail: "imogen" }, []);
    expect(!result.ok && result.errors.contactEmail).toBe("Contact email must be a valid address.");
  });

  it("maps a null venue, timestamp dates and the contact from the API detail", () => {
    const form = exhibitionFormFromDetail(exhibitionDetail);
    expect(form).toMatchObject({
      venueId: "",
      startsOn: "2026-06-01",
      endsOn: "",
      kind: "event",
      subtitle: "A group show",
      contactRole: "Gallery manager",
      contactAvatarMediaKey: "shop/editorial-inline/imogen.jpg",
    });
  });
});
