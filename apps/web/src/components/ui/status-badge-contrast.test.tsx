import { createTokenContrast } from "@/test/css-token-contrast";
import { STATUS_BADGE_TONE_CLASSES, type StatusBadgeTone } from "@auction/ui";
import { describe, expect, it } from "vitest";

const TONES = Object.keys(STATUS_BADGE_TONE_CLASSES) as StatusBadgeTone[];

/** The tint and label colours a tone draws with, read from the kit's own table. */
function toneColours(tone: StatusBadgeTone) {
  const classes = STATUS_BADGE_TONE_CLASSES[tone].split(" ");
  const colour = (prefix: "bg" | "text") => {
    const match = classes.find((c) => c.startsWith(`${prefix}-[`));
    if (!match) throw new Error(`${tone}: no ${prefix} class`);
    return match.slice(prefix.length + 2, -1);
  };
  return { fill: colour("bg"), label: colour("text") };
}

describe("status badge contrast in Bid", () => {
  const contrast = createTokenContrast();

  it("draws every tone from the LAX status palette, Bid's one palette", () => {
    for (const tone of TONES) {
      expect(toneColours(tone).fill).toMatch(/^var\(--lax-/);
      expect(toneColours(tone).label).toMatch(/^var\(--lax-/);
    }
  });

  describe.each(["light", "dark"] as const)("%s", (theme) => {
    it.each(TONES)("%s label and cue read at 4.5:1 on the tint", (tone) => {
      const { fill, label } = toneColours(tone);
      expect(contrast(label, fill, theme)).toBeGreaterThanOrEqual(4.5);
    });

    // Live is a solid fill on purpose: something happening now stands apart from a failure.
    it.each(TONES.filter((tone) => tone !== "live"))(
      "%s tint sits with the page instead of glowing on it",
      (tone) => {
        const { fill } = toneColours(tone);
        expect(contrast(fill, "surface", theme)).toBeLessThan(2);
      },
    );
  });
});
