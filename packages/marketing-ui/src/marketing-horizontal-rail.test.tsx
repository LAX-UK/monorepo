import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { MarketingHorizontalRail } from "./marketing-horizontal-rail.js";

describe("MarketingHorizontalRail", () => {
  beforeAll(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
  });

  it("leaves vertical page scroll to smooth scrolling and only claims horizontal gestures", () => {
    render(
      <MarketingHorizontalRail id="rail" ariaLabel="Prints" forwardAriaLabel="More prints">
        <div>Card</div>
      </MarketingHorizontalRail>,
    );
    const scroller = screen.getByLabelText("Prints");
    expect(scroller).toHaveAttribute("data-lenis-prevent-horizontal");
    expect(scroller).not.toHaveAttribute("data-lenis-prevent");
    expect(scroller).toHaveClass("overflow-y-hidden", "overscroll-x-contain");
  });
});
