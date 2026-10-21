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

  it("keeps the bordered circle as the default appearance", () => {
    render(<MarketingHeartToggle pressed onPressedChange={() => {}} label="Saved" />);
    const button = screen.getByRole("button", { name: "Saved" });
    expect(button).toHaveAttribute("data-appearance", "circle");
    const visual = button.querySelector("span");
    expect(visual?.className).toContain("border");
    expect(visual?.className).toContain("bg-[color:var(--color-favorite,var(--color-primary))]");
  });

  it("renders a bare 24px glyph that keeps the 44px hit area", () => {
    render(
      <MarketingHeartToggle
        pressed={false}
        onPressedChange={() => {}}
        label="Save Untitled"
        appearance="bare"
        size="sm"
      />,
    );
    const button = screen.getByRole("button", { name: "Save Untitled" });
    expect(button.className).toContain("size-11");
    const visual = button.querySelector("span");
    expect(visual?.className).toContain("size-6");
    expect(visual?.className).not.toContain("border");
    expect(visual?.className).not.toContain("rounded-full");
    expect(button.querySelector("svg")?.getAttribute("class")).toContain("size-6");
  });

  it("fills a saved bare glyph with the favourite colour", () => {
    render(
      <MarketingHeartToggle pressed onPressedChange={() => {}} label="Saved" appearance="bare" />,
    );
    const button = screen.getByRole("button", { name: "Saved" });
    expect(button.querySelector("span")?.className).toContain(
      "text-[color:var(--color-favorite,var(--color-primary))]",
    );
    expect(button.querySelector("svg")?.getAttribute("class")).toContain("fill-current");
  });

  it("puts the on-media glyph on a translucent disc", () => {
    render(
      <MarketingHeartToggle
        pressed={false}
        onPressedChange={() => {}}
        label="Save"
        appearance="onMedia"
      />,
    );
    const visual = screen.getByRole("button", { name: "Save" }).querySelector("span");
    expect(visual?.className).toContain("size-10");
    expect(visual?.className).toContain("bg-surface/80");
    expect(visual?.className).toContain("rounded-full");
  });
});
