import { createTokenContrast } from "@/test/css-token-contrast";
import { DotStatusPill, type DotStatusPillTone } from "@auction/ui";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

const TONES: DotStatusPillTone[] = [
  "live",
  "sold",
  "public",
  "pending",
  "draft",
  "warning",
  "critical",
  "neutral",
  "info",
  "success",
  "accent",
];

/** The pill's own token classes, read from what it renders. */
function pillTokens(tone: DotStatusPillTone) {
  const { container, unmount } = render(<DotStatusPill label="Status" tone={tone} />);
  const pill = container.firstElementChild as HTMLElement;
  const glyph = pill.firstElementChild as HTMLElement;
  const token = (el: Element, prefix: "bg" | "text") => {
    // The colour class comes after size classes such as text-xs.
    const match = [...el.classList].filter((c) => c.startsWith(`${prefix}-`)).at(-1);
    if (!match) throw new Error(`${tone}: no ${prefix} class`);
    return match.slice(prefix.length + 1);
  };
  const tokens = {
    fill: token(pill, "bg"),
    label: token(pill, "text"),
    glyphFill: token(glyph, "bg"),
    glyph: token(glyph.querySelector("svg") as Element, "text"),
  };
  unmount();
  return tokens;
}

describe("status pill contrast in Bid", () => {
  const contrast = createTokenContrast();

  describe.each(["light", "dark"] as const)("%s", (theme) => {
    it.each(TONES)("%s label reads at 4.5:1 on its tint", (tone) => {
      const { fill, label } = pillTokens(tone);
      expect(contrast(label, fill, theme)).toBeGreaterThanOrEqual(4.5);
    });

    it.each(TONES)("%s glyph reads at 3:1 on its circle", (tone) => {
      const { glyphFill, glyph } = pillTokens(tone);
      expect(contrast(glyph, glyphFill, theme)).toBeGreaterThanOrEqual(3);
    });
  });
});
