import { assembleCoverAnalysis } from "@auction/domain";
import { describe, expect, it } from "vitest";
import { BUSY_MID_ZONES, CALM_DARK_ZONES } from "../../test-support/in-memory-home-cover.js";
import {
  HOME_COVER_MIN_WIDTH,
  homeCoverCanCarryType,
  homeCoverInputIssues,
  homeCoverScrims,
  homeCoverSide,
} from "./home-cover.rules.js";

function analysisFor(zones: typeof CALM_DARK_ZONES) {
  return assembleCoverAnalysis(
    {
      dominant: [24, 28, 40],
      deepest: [12, 14, 20],
      blurDataURL: "data:image/webp;base64,AAAA",
      zones: { desktop: zones, wide: zones },
    },
    "left",
  );
}

describe("homeCoverInputIssues", () => {
  it("accepts alt text and a picture at the floor", () => {
    expect(homeCoverInputIssues({ alt: "A river at dusk", width: HOME_COVER_MIN_WIDTH })).toEqual(
      [],
    );
  });

  it("asks for alt text, ignoring spaces", () => {
    expect(homeCoverInputIssues({ alt: "   ", width: 4000 })).toEqual(["alt_missing"]);
  });

  it("refuses a picture narrower than the floor, and reports both problems together", () => {
    expect(homeCoverInputIssues({ alt: "", width: HOME_COVER_MIN_WIDTH - 1 })).toEqual([
      "alt_missing",
      "picture_too_narrow",
    ]);
  });
});

describe("homeCoverSide", () => {
  it("puts the type away from the subject", () => {
    expect(homeCoverSide({ x: 0.2, y: 0.5 })).toBe("right");
    expect(homeCoverSide({ x: 0.8, y: 0.5 })).toBe("left");
  });
});

describe("homeCoverCanCarryType", () => {
  it("is true when white type reaches contrast on a deep picture", () => {
    const analysis = analysisFor(CALM_DARK_ZONES);
    expect(homeCoverCanCarryType(analysis)).toBe(true);
    expect(homeCoverScrims(analysis).desktop?.tone).toBe("light");
    expect(homeCoverScrims(analysis).wide).not.toBeNull();
  });

  it("is false when neither tone reaches contrast", () => {
    expect(homeCoverCanCarryType(analysisFor(BUSY_MID_ZONES))).toBe(false);
  });
});
