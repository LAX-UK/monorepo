import { TypeCompiler } from "@sinclair/typebox/compiler";
import { describe, expect, it } from "vitest";
import { PublicArtistSortSchema } from "./artist-public.js";

describe("PublicArtistSortSchema", () => {
  const check = TypeCompiler.Compile(PublicArtistSortSchema);

  it("accepts the directory sorts and the latest-edition sort", () => {
    for (const sort of ["newest", "nameAsc", "nameDesc", "latestEdition"]) {
      expect(check.Check(sort)).toBe(true);
    }
  });

  it("rejects any other sort", () => {
    expect(check.Check("latest")).toBe(false);
    expect(check.Check("priceAsc")).toBe(false);
  });
});
