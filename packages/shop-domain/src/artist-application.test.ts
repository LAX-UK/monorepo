import { describe, expect, it } from "vitest";
import {
  ARTIST_APPLICATION_ACTIONS,
  ARTIST_APPLICATION_LIMITS,
  ARTIST_APPLICATION_STATUSES,
  type ArtistApplicationAction,
  type ArtistApplicationContent,
  type ArtistApplicationStatus,
  type ArtistApplicationWork,
  artistApplicationReapplyDate,
  artistApplicationSubmitBlockers,
  assertArtistApplicationContentWithinLimits,
  assertMessageToArtist,
  availableArtistApplicationActions,
  decideArtistApplicationStart,
  isArtistApplicationEditable,
  nextArtistApplicationStatus,
  normaliseArtistApplicationUrl,
  transitionArtistApplication,
} from "./artist-application.js";
import { ShopDomainError } from "./shop-domain-error.js";

/** The full table, written out once more so a change to the rules has to change the test. */
const EXPECTED: Record<
  ArtistApplicationAction,
  Partial<Record<ArtistApplicationStatus, ArtistApplicationStatus>>
> = {
  submit: { draft: "submitted" },
  resubmit: { more_info_needed: "in_review" },
  assign: {
    submitted: "in_review",
    in_review: "in_review",
    more_info_needed: "more_info_needed",
  },
  request_info: { submitted: "more_info_needed", in_review: "more_info_needed" },
  accept: { submitted: "accepted", in_review: "accepted" },
  decline: { submitted: "declined", in_review: "declined", more_info_needed: "declined" },
};

describe("artist application transitions", () => {
  it.each(
    ARTIST_APPLICATION_ACTIONS.flatMap((action) =>
      ARTIST_APPLICATION_STATUSES.map((from) => [action, from] as const),
    ),
  )("%s from %s", (action, from) => {
    expect(nextArtistApplicationStatus(action, from)).toBe(EXPECTED[action][from] ?? null);
  });

  it("throws a domain error with a reason when the table refuses", () => {
    expect(() => transitionArtistApplication("accept", "more_info_needed")).toThrow(
      ShopDomainError,
    );
    expect(() => transitionArtistApplication("decline", "accepted")).toThrow(
      "A decided application cannot be declined",
    );
  });

  it("keeps decided applications final", () => {
    for (const action of ARTIST_APPLICATION_ACTIONS) {
      expect(nextArtistApplicationStatus(action, "accepted")).toBeNull();
      expect(nextArtistApplicationStatus(action, "declined")).toBeNull();
    }
  });

  it("offers staff and the applicant only their own actions", () => {
    expect(availableArtistApplicationActions("in_review", "staff")).toEqual([
      "assign",
      "request_info",
      "accept",
      "decline",
    ]);
    expect(availableArtistApplicationActions("in_review", "applicant")).toEqual([]);
    expect(availableArtistApplicationActions("draft", "applicant")).toEqual(["submit"]);
    expect(availableArtistApplicationActions("draft", "staff")).toEqual([]);
    expect(availableArtistApplicationActions("more_info_needed", "applicant")).toEqual([
      "resubmit",
    ]);
    expect(availableArtistApplicationActions("more_info_needed", "staff")).toEqual([
      "assign",
      "decline",
    ]);
  });

  it("lets the applicant edit only a draft or an application waiting on them", () => {
    const editable = ARTIST_APPLICATION_STATUSES.filter(isArtistApplicationEditable);
    expect(editable).toEqual(["draft", "more_info_needed"]);
  });
});

describe("applying again", () => {
  const now = new Date("2026-10-28T12:00:00Z");

  it("starts a first application", () => {
    expect(decideArtistApplicationStart(null, now)).toEqual({ kind: "start" });
  });

  it.each(["draft", "submitted", "in_review", "more_info_needed"] as const)(
    "continues an open %s application",
    (status) => {
      expect(decideArtistApplicationStart({ id: "a1", status, decidedAt: null }, now)).toEqual({
        kind: "continue",
        applicationId: "a1",
      });
    },
  );

  it("sends an accepted artist to the portal", () => {
    expect(
      decideArtistApplicationStart({ id: "a1", status: "accepted", decidedAt: now }, now),
    ).toEqual({ kind: "accepted" });
  });

  it("asks a recently declined artist to wait six months", () => {
    const decidedAt = new Date("2026-08-31T09:00:00Z");
    expect(decideArtistApplicationStart({ id: "a1", status: "declined", decidedAt }, now)).toEqual({
      kind: "wait",
      availableFrom: new Date("2027-02-28T09:00:00Z"),
    });
  });

  it("lets a declined artist apply again once six months have passed", () => {
    const decidedAt = new Date("2026-04-28T12:00:00Z");
    expect(decideArtistApplicationStart({ id: "a1", status: "declined", decidedAt }, now)).toEqual({
      kind: "start",
    });
  });

  it("keeps the day of the month, clamped to the month's last day", () => {
    expect(artistApplicationReapplyDate(new Date("2026-01-15T00:00:00Z"))).toEqual(
      new Date("2026-07-15T00:00:00Z"),
    );
    expect(artistApplicationReapplyDate(new Date("2026-08-31T00:00:00Z"))).toEqual(
      new Date("2027-02-28T00:00:00Z"),
    );
  });
});

const WORK: ArtistApplicationWork = {
  mediaKey: "shop/artist-application/1.jpg",
  title: "Morning tide",
  year: 2024,
  medium: "Oil on linen",
  size: "100 × 80 cm",
  kind: "original",
};

function works(count: number): ArtistApplicationWork[] {
  return Array.from({ length: count }, (_, index) => ({
    ...WORK,
    mediaKey: `shop/artist-application/${index}.jpg`,
  }));
}

const COMPLETE: ArtistApplicationContent = {
  artistName: "Ada Moreno",
  location: "Lisbon, Portugal",
  website: "https://adamoreno.example",
  socialLinks: ["https://instagram.com/adamoreno"],
  shortBio: "Painter working with coastal light.",
  statement: "I paint the hour before the tide turns.",
  representation: null,
  exhibitions: null,
  works: works(6),
  consentToContact: true,
};

describe("submit blockers", () => {
  const now = new Date("2026-10-28T12:00:00Z");

  it("lets a complete application be sent", () => {
    expect(artistApplicationSubmitBlockers(COMPLETE, now)).toEqual([]);
  });

  it("names each missing answer with its step and field", () => {
    const blockers = artistApplicationSubmitBlockers(
      {
        ...COMPLETE,
        artistName: " ",
        shortBio: null,
        statement: "",
        works: works(4),
        consentToContact: false,
      },
      now,
    );
    expect(blockers.map((b) => [b.step, b.field])).toEqual([
      ["about", "artistName"],
      ["about", "shortBio"],
      ["work", "works"],
      ["statement", "statement"],
      ["agreement", "consentToContact"],
    ]);
    expect(blockers[2]?.message).toBe("Add 2 more works: we need at least 6.");
  });

  it("checks every detail of each work", () => {
    const incomplete = works(6);
    incomplete[2] = { ...WORK, mediaKey: "x", title: null, year: 1850, kind: null };
    const blockers = artistApplicationSubmitBlockers({ ...COMPLETE, works: incomplete }, now);
    expect(blockers.map((b) => b.field)).toEqual(["works.2.title", "works.2.year", "works.2.kind"]);
    expect(blockers[1]?.message).toBe("Enter a year between 1900 and 2026 for work 3.");
  });

  it("refuses a year in the future", () => {
    const later = works(6);
    later[0] = { ...WORK, year: 2027 };
    expect(
      artistApplicationSubmitBlockers({ ...COMPLETE, works: later }, now).map((b) => b.field),
    ).toEqual(["works.0.year"]);
  });
});

describe("content limits", () => {
  it("accepts a partial draft", () => {
    expect(() =>
      assertArtistApplicationContentWithinLimits({
        ...COMPLETE,
        artistName: null,
        works: [],
        consentToContact: false,
      }),
    ).not.toThrow();
  });

  it.each<[string, Partial<ArtistApplicationContent>]>([
    ["too many works", { works: works(ARTIST_APPLICATION_LIMITS.maxWorks + 1) }],
    ["a repeated image", { works: [WORK, WORK] }],
    ["a long statement", { statement: "x".repeat(ARTIST_APPLICATION_LIMITS.statement + 1) }],
    ["too many social links", { socialLinks: Array(5).fill("https://a.example") }],
    ["a website that is not a web address", { website: "javascript:alert(1)" }],
    ["a social link without a host", { socialLinks: ["adamoreno"] }],
  ])("refuses %s", (_label, change) => {
    expect(() => assertArtistApplicationContentWithinLimits({ ...COMPLETE, ...change })).toThrow(
      ShopDomainError,
    );
  });
});

describe("web addresses", () => {
  it.each([
    ["studio.example.com", "https://studio.example.com/"],
    ["https://instagram.com/ada", "https://instagram.com/ada"],
    ["http://old.example/page", "http://old.example/page"],
  ])("normalises %s", (input, expected) => {
    expect(normaliseArtistApplicationUrl(input)).toBe(expected);
  });

  it.each(["", "ftp://files.example", "javascript:alert(1)", "localhost", "https://u:p@a.example"])(
    "refuses %s",
    (input) => {
      expect(normaliseArtistApplicationUrl(input)).toBeNull();
    },
  );
});

describe("notes to the artist", () => {
  it("trims a note and refuses an empty or long one", () => {
    expect(assertMessageToArtist("  Please add a studio photo. ")).toBe(
      "Please add a studio photo.",
    );
    expect(() => assertMessageToArtist("   ")).toThrow(ShopDomainError);
    expect(() =>
      assertMessageToArtist("x".repeat(ARTIST_APPLICATION_LIMITS.messageToArtist + 1)),
    ).toThrow(ShopDomainError);
  });
});
