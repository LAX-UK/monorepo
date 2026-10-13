import { artworkDetail } from "@/lib/testing/fake-art-services";
import { describe, expect, it } from "vitest";
import {
  artworkCertificateLine,
  buildArtworkSpecGroups,
  formatArtworkDimensionsInches,
} from "./artwork-spec.presenter.js";

describe("buildArtworkSpecGroups", () => {
  it("splits specs into details and medium & dimensions, with cm and inches", () => {
    expect(
      buildArtworkSpecGroups(
        artworkDetail({
          dimensions: "16 × 20 in",
          dimensionsCmDisplay: "40 × 50 cm",
          heightCm: 40,
          widthCm: 50,
          medium: "Oil on linen",
          yearCreated: 2024,
          objectType: "work_on_paper",
          rarity: "limited_edition",
          hasCertificate: true,
        }),
      ),
    ).toEqual({
      details: [
        { label: "Object type", value: "Work on paper" },
        { label: "Rarity", value: "Limited edition" },
        { label: "Year", value: "2024" },
        { label: "Certificate", value: "Included" },
      ],
      mediumAndDimensions: [
        { label: "Medium", value: "Oil on linen" },
        { label: "Dimensions", value: "40 × 50 cm" },
        { label: "Dimensions (in)", value: "15.7 × 19.7 in" },
      ],
    });
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
    expect(buildArtworkSpecGroups(legacy)).toEqual({ details: [], mediumAndDimensions: [] });
  });

  it("keeps free-text dimensions without inventing an inch conversion", () => {
    expect(
      buildArtworkSpecGroups(
        artworkDetail({ dimensionsCmDisplay: null, dimensions: "Variable", medium: null }),
      ).mediumAndDimensions,
    ).toEqual([{ label: "Dimensions", value: "Variable" }]);
  });
});

describe("formatArtworkDimensionsInches", () => {
  it("includes depth only when it is positive", () => {
    expect(formatArtworkDimensionsInches({ heightCm: 25.4, widthCm: 50.8, depthCm: 5 })).toBe(
      "10 × 20 × 2 in",
    );
    expect(formatArtworkDimensionsInches({ heightCm: 25.4, widthCm: 50.8, depthCm: 0 })).toBe(
      "10 × 20 in",
    );
    expect(
      formatArtworkDimensionsInches({ heightCm: null, widthCm: 50.8, depthCm: null }),
    ).toBeNull();
  });
});

describe("artworkCertificateLine", () => {
  it("states the certificate only when one is included", () => {
    expect(artworkCertificateLine(artworkDetail({ hasCertificate: true }))).toBe(
      "Includes a certificate of authenticity",
    );
    expect(artworkCertificateLine(artworkDetail({ hasCertificate: false }))).toBeNull();
  });
});
