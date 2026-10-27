import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContextBannerSlot } from "./context-banner-slot";

describe("ContextBannerSlot", () => {
  it("adds its gap only through not-empty, so a silent banner leaves no space", () => {
    const { container } = render(<ContextBannerSlot>{null}</ContextBannerSlot>);
    const slot = container.querySelector("[data-context-banner-slot]");
    expect(slot).toBeEmptyDOMElement();
    expect(slot?.className).toContain("not-empty:mb-4");
    expect(slot?.className).not.toMatch(/(^|\s)mb-4/);
  });

  it("holds a banner when one is showing", () => {
    const { getByRole } = render(
      <ContextBannerSlot>
        <p role="alert">Staff permissions may be out of date</p>
      </ContextBannerSlot>,
    );
    expect(getByRole("alert")).toBeInTheDocument();
  });
});
