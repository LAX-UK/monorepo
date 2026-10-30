import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingSplitFeature } from "./marketing-split-feature.js";

const media = <img alt="" src="/m.webp" />;

describe("MarketingSplitFeature mobileOrder", () => {
  it("keeps the media first on phones by default", () => {
    render(<MarketingSplitFeature title="Guide" media={media} />);
    const slot = screen.getByTestId("marketing-split-feature-media");
    expect(slot).not.toHaveClass("order-last");
    expect(slot).toHaveClass("md:order-last");
  });

  it("leads with the copy on phones and keeps the desktop side", () => {
    render(<MarketingSplitFeature title="Hub" media={media} mobileOrder="text-first" />);
    expect(screen.getByTestId("marketing-split-feature-media")).toHaveClass(
      "order-last",
      "md:order-last",
    );
  });

  it("puts left-side media back on the left from md when the copy leads on phones", () => {
    render(
      <MarketingSplitFeature title="Hub" media={media} mediaSide="left" mobileOrder="text-first" />,
    );
    expect(screen.getByTestId("marketing-split-feature-media")).toHaveClass(
      "order-last",
      "md:order-first",
    );
  });
});
