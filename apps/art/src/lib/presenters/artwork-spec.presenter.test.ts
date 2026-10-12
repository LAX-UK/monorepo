import { artworkDetail } from "@/lib/testing/fake-art-services";
import { describe, expect, it } from "vitest";
import { buildArtworkSpecRows } from "./artwork-spec.presenter.js";

describe("buildArtworkSpecRows", () => {
  it("lists every known spec in display order, preferring centimetre dimensions", () => {
    expect(
      buildArtworkSpecRows(
        artworkDetail({
          dimensions: "16 × 20 in",
          dimensionsCmDisplay: "40 × 50 cm",
          medium: "Oil on linen",
          yearCreated: 2024,
          objectType: "work_on_paper",
          rarity: "limited_edition",
          hasCertificate: true,
        }),
      ),
    ).toEqual([
      { label: "Dimensions", value: "40 × 50 cm" },
      { label: "Medium", value: "Oil on linen" },
      { label: "Year", value: "2024" },
      { label: "Object type", value: "Work on paper" },
      { label: "Rarity", value: "Limited edition" },
      { label: "Certificate", value: "Included" },
    ]);
  });

  it("omits unknown specs, including fields an older API does not send", () => {
    const {
      dimensionsCmDisplay: _d,
      objectType: _o,
      rarity: _r,
      ...legacy
    } = artworkDetail({
      dimensions: null,
      medium: null,
      yearCreated: null,
      hasCertificate: false,
    });
    expect(buildArtworkSpecRows(legacy)).toEqual([]);
  });

  it("falls back to free-text dimensions", () => {
    expect(
      buildArtworkSpecRows(
        artworkDetail({ dimensionsCmDisplay: null, dimensions: "Variable", medium: null }),
      )[0],
    ).toEqual({ label: "Dimensions", value: "Variable" });
  });
});
