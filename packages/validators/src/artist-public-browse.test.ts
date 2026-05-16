import { describe, expect, it } from "vitest";
import { publicArtistBrowseQuerySchema } from "./artist.js";

describe("publicArtistBrowseQuerySchema", () => {
  it("parses kinds CSV into enum array", () => {
    const r = publicArtistBrowseQuerySchema.parse({ kinds: "brand,marque" });
    expect(r.kinds).toEqual(["brand", "marque"]);
  });

  it("drops invalid kind tokens", () => {
    const r = publicArtistBrowseQuerySchema.parse({ kinds: "artist,invalid,brand" });
    expect(r.kinds).toEqual(["artist", "brand"]);
  });

  it("treats empty sort as name_asc default", () => {
    const r = publicArtistBrowseQuerySchema.parse({ sort: "" });
    expect(r.sort).toBe("name_asc");
  });
});
