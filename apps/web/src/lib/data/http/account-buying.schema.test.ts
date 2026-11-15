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
    ).toEqual({ date: "2026-12-09", state: "soon", placeId: "venue-1", placeName: "LAX Gallery" });
  });

  it("reads an API that predates the venue id, so either can deploy first", () => {
    expect(
      collectBySchema.parse({ date: "2026-12-09", state: "soon", placeName: "LAX Gallery" }),
    ).toEqual({ date: "2026-12-09", state: "soon", placeId: null, placeName: "LAX Gallery" });
  });
});
