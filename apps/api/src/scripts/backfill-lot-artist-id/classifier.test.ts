import { describe, expect, it } from "vitest";
import { classifyLotArtistBackfill, hintFromLotTitle, looksLikeAuthUserId } from "./classifier.js";

describe("classifyLotArtistBackfill", () => {
  it("classifies clean_artist_profile_id from UUID column with single lookup hit", () => {
    const r = classifyLotArtistBackfill({
      artistIdColumn: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      marketingSellerArtistId: null,
      hintText: null,
      uuidLookupHits: [{ id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", displayName: "Ada" }],
      textLookupHits: [],
    });
    expect(r.classification).toBe("clean_artist_profile_id");
    expect(r.suggestedArtistId).toBe("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
  });

  it("uses marketing sellerArtistId when artist column empty", () => {
    const id = "bbbbbbbb-cccc-dddd-eeee-ffffffffffff";
    const r = classifyLotArtistBackfill({
      artistIdColumn: null,
      marketingSellerArtistId: id,
      hintText: null,
      uuidLookupHits: [{ id, displayName: "Canonical" }],
      textLookupHits: [],
    });
    expect(r.classification).toBe("clean_artist_profile_id");
    expect(r.suggestedArtistName).toBe("Canonical");
  });

  it("flags auth user id stuffed into artist_id", () => {
    const r = classifyLotArtistBackfill({
      artistIdColumn: "user_clarity_session_abc123xyz",
      marketingSellerArtistId: null,
      hintText: null,
      uuidLookupHits: [],
      textLookupHits: [],
    });
    expect(r.classification).toBe("value_is_user_id");
  });

  it("clean_text_match when exactly one text candidate", () => {
    const r = classifyLotArtistBackfill({
      artistIdColumn: null,
      marketingSellerArtistId: null,
      hintText: "Banksy",
      uuidLookupHits: [],
      textLookupHits: [{ id: "u1", displayName: "Banksy" }],
    });
    expect(r.classification).toBe("clean_text_match");
    expect(r.suggestedArtistId).toBe("u1");
  });

  it("ambiguous_text when multiple candidates", () => {
    const r = classifyLotArtistBackfill({
      artistIdColumn: null,
      marketingSellerArtistId: null,
      hintText: "Smith",
      uuidLookupHits: [],
      textLookupHits: [
        { id: "a", displayName: "Jane Smith" },
        { id: "b", displayName: "John Smith" },
      ],
    });
    expect(r.classification).toBe("ambiguous_text");
    expect(r.ambiguityCount).toBe(2);
  });
});

describe("hintFromLotTitle", () => {
  it("parses em-dash separated artist prefix", () => {
    expect(hintFromLotTitle("Monet — Water Lilies")).toBe("Monet");
  });
});

describe("looksLikeAuthUserId", () => {
  it("returns false for UUIDs", () => {
    expect(looksLikeAuthUserId("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")).toBe(false);
  });
});
