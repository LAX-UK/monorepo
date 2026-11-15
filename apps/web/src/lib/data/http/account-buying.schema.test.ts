import { describe, expect, it } from "vitest";

import { collectBySchema } from "./account-buying.server";

describe("the collect-by notice as the API sends it", () => {
  it("keeps the venue id the API sends", () => {
    expect(
      collectBySchema.parse({
        date: "2026-12-09",
        state: "soon",
        placeId: "venue-1",
        placeName: "LAX Gallery",
      }),
    ).toEqual({
      date: "2026-12-09",
      state: "soon",
      placeId: "venue-1",
      placeName: "LAX Gallery",
      storage: null,
    });
  });

  it("reads an API that predates the venue id, so either can deploy first", () => {
    expect(
      collectBySchema.parse({ date: "2026-12-09", state: "soon", placeName: "LAX Gallery" }),
    ).toEqual({
      date: "2026-12-09",
      state: "soon",
      placeId: null,
      placeName: "LAX Gallery",
      storage: null,
    });
  });

  it("keeps the buyer's storage wording when the API sends it", () => {
    const storage = {
      state: "charging",
      notice: { heading: "Storage charges since Tue 17 Nov", body: "£9.00 so far" },
      badge: "Collect by Mon 16 Nov · Storage £9.00 so far",
      amountPence: 900,
    };
    expect(
      collectBySchema.parse({
        date: "2026-11-16",
        state: "overdue",
        placeName: "LAX Gallery",
        storage,
      }).storage,
    ).toEqual(storage);
  });
});
