import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MarketingHeartToggle } from "./marketing-heart-toggle.js";

describe("MarketingHeartToggle", () => {
  it("exposes pressed state and requests the inverse on click", () => {
    const onPressedChange = vi.fn();
    render(
      <MarketingHeartToggle
        pressed={false}
        onPressedChange={onPressedChange}
        label="Save Untitled to favorites"
      />,
    );
    const button = screen.getByRole("button", { name: "Save Untitled to favorites" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(button);
    expect(onPressedChange).toHaveBeenCalledWith(true);
  });

  it("keeps a 44px hit area around the 40px visual circle", () => {
    render(<MarketingHeartToggle pressed onPressedChange={() => {}} label="Saved" />);
    const button = screen.getByRole("button", { name: "Saved" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button.className).toContain("size-11");
    expect(button.querySelector("span")?.className).toContain("size-10");
  });

  it("ignores presses while busy", () => {
    const onPressedChange = vi.fn();
    render(<MarketingHeartToggle pressed onPressedChange={onPressedChange} label="Saved" busy />);
    const button = screen.getByRole("button", { name: "Saved" });
    fireEvent.click(button);
    expect(onPressedChange).not.toHaveBeenCalled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });
});
