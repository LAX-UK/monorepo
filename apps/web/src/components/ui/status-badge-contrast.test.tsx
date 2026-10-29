import { createTokenContrast } from "@/test/css-token-contrast";
import { STATUS_BADGE_TONE_CLASSES, type StatusBadgeTone } from "@auction/ui";
import { describe, expect, it } from "vitest";

const TONES = Object.keys(STATUS_BADGE_TONE_CLASSES) as StatusBadgeTone[];

/** The tint and label tokens a tone draws with, read from the kit's own table. */
function toneTokens(tone: StatusBadgeTone) {
  const classes = STATUS_BADGE_TONE_CLASSES[tone].split(" ");
  const token = (prefix: "bg" | "text") => {
    const match = classes.find((c) => c.startsWith(`${prefix}-`));
    if (!match) throw new Error(`${tone}: no ${prefix} class`);
    return match.slice(prefix.length + 1);
  };
  return { fill: token("bg"), label: token("text") };
}

describe("status badge contrast in Bid", () => {
  const contrast = createTokenContrast();

  describe.each(["light", "dark"] as const)("%s", (theme) => {
    it.each(TONES)("%s label and cue read at 4.5:1 on the tint", (tone) => {
      const { fill, label } = toneTokens(tone);
      expect(contrast(label, fill, theme)).toBeGreaterThanOrEqual(4.5);
    });

    it.each(TONES)("%s tint sits with the page instead of glowing on it", (tone) => {
      const { fill } = toneTokens(tone);
      expect(contrast(fill, "surface", theme)).toBeLessThan(2);
    });
  });
});
