import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingStickyActionBar } from "./marketing-sticky-action-bar.js";

describe("MarketingStickyActionBar", () => {
  it("is a named region fixed above the given bottom offset", () => {
    render(
      <MarketingStickyActionBar ariaLabel="Artwork actions" bottomOffset="var(--nav-height)">
        <span>Enquire</span>
      </MarketingStickyActionBar>,
    );
    const bar = screen.getByRole("region", { name: "Artwork actions" });
    expect(bar.className).toContain("fixed");
    expect(bar.style.bottom).toBe("var(--nav-height)");
    expect(bar.className).toContain("pb-3");
    expect(screen.getByText("Enquire")).toBeInTheDocument();
  });

  it("pads for the safe area itself without an offset", () => {
    render(
      <MarketingStickyActionBar ariaLabel="Actions">
        <span>Body</span>
      </MarketingStickyActionBar>,
    );
    expect(screen.getByRole("region", { name: "Actions" }).className).toContain(
      "safe-area-inset-bottom",
    );
  });

  it("returns to normal flow from md when asked", () => {
    render(
      <MarketingStickyActionBar ariaLabel="Actions" inlineFromMd>
        <span>Body</span>
      </MarketingStickyActionBar>,
    );
    expect(screen.getByRole("region", { name: "Actions" }).className).toContain("md:static");
  });
});
