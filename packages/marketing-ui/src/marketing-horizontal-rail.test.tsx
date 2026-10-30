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

  describe("controls below the rail", () => {
    function mockOverflow(scrollWidth: number) {
      const scroll = vi
        .spyOn(HTMLElement.prototype, "scrollWidth", "get")
        .mockReturnValue(scrollWidth);
      const client = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1000);
      return () => {
        scroll.mockRestore();
        client.mockRestore();
      };
    }

    function renderRail() {
      render(
        <MarketingHorizontalRail
          id="now-on"
          ariaLabel="Now on"
          forwardAriaLabel="Next exhibition"
          backAriaLabel="Previous exhibition"
          controls="arrows-progress"
          controlsPlacement="below"
          edgeFade={false}
        >
          <div>Slide</div>
        </MarketingHorizontalRail>,
      );
    }

    it("shows both arrows in one row and disables the one at the start", () => {
      const restore = mockOverflow(3000);
      renderRail();
      expect(screen.getByRole("button", { name: "Previous exhibition" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Next exhibition" })).toBeEnabled();
      expect(screen.getByTestId("marketing-rail-controls")).toContainElement(
        screen.getByTestId("marketing-rail-progress"),
      );
      restore();
    });

    it("renders no controls when everything fits", () => {
      const restore = mockOverflow(1000);
      renderRail();
      expect(screen.queryByTestId("marketing-rail-controls")).not.toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      restore();
    });
  });
});
