import { MARKETING_CARD_LIFT, MARKETING_CARD_MEDIA_HOVER } from "@auction/branding";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingCardMedia } from "./marketing-card-media.js";
import { MarketingCardShell } from "./marketing-card-shell.js";

/**
 * The marketing cards use the kit's one card hover (packages/ui/src/lax/hover-press.css, MO9):
 * the classes below are its whole interface. What they do in a browser (1px lift, 1.02 zoom,
 * underline, mouse only, none under reduced motion or on staff pages) is proved in Chromium by
 * packages/ui/src/lax/hover-press-resolved.test.ts.
 */
const OLD_HOVER = /scale-\[1\.0|scale-105|-translate-y|duration-700|transition-transform/;

describe("marketing card hover wiring", () => {
  it("the card frame constant is the kit frame and lift, with no hand-written motion", () => {
    const classes = MARKETING_CARD_LIFT.split(" ");
    expect(classes).toEqual(expect.arrayContaining(["lax-card", "lax-card-lift"]));
    expect(MARKETING_CARD_LIFT).not.toMatch(OLD_HOVER);
  });

  it("the card image constant is the kit zoom", () => {
    expect(MARKETING_CARD_MEDIA_HOVER).toBe("lax-card-zoom");
  });

  it("MarketingCardMedia is a kit media box: its images zoom when the card is hovered", () => {
    const { container } = render(
      <MarketingCardMedia className="aspect-square">
        <img alt="" src="/a.jpg" />
      </MarketingCardMedia>,
    );
    const box = container.firstElementChild as HTMLElement;
    expect(box).toHaveClass("lax-card-media", "relative", "overflow-hidden", "aspect-square");
    expect(box.className).not.toMatch(OLD_HOVER);
  });

  it("an interactive MarketingCardShell is a lifting card frame; a static one does not move", () => {
    const { container, rerender } = render(<MarketingCardShell>x</MarketingCardShell>);
    expect(container.firstElementChild).toHaveClass("lax-card", "lax-card-lift");
    rerender(<MarketingCardShell interactive={false}>x</MarketingCardShell>);
    expect(container.firstElementChild).not.toHaveClass("lax-card");
    expect(container.firstElementChild).not.toHaveClass("lax-card-lift");
  });
});
