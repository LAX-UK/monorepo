import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MarketingReadMore } from "./marketing-read-more.js";

function mockLayout(scrollHeight: number, clientHeight: number) {
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(scrollHeight);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(clientHeight);
}

describe("MarketingReadMore", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("offers Read more when the clamped copy overflows and toggles aria-expanded", () => {
    mockLayout(200, 72);
    render(
      <MarketingReadMore lines={3}>
        <p>Long biography</p>
      </MarketingReadMore>,
    );
    const toggle = screen.getByRole("button", { name: "Read more" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    const content = document.getElementById(toggle.getAttribute("aria-controls") ?? "");
    expect(content).toHaveTextContent("Long biography");
    expect(content?.style.webkitLineClamp).toBe("3");

    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Read less" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(content?.style.webkitLineClamp).toBe("");
  });

  it("hides the toggle when the copy fits", () => {
    mockLayout(48, 48);
    render(
      <MarketingReadMore>
        <p>Short</p>
      </MarketingReadMore>,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
