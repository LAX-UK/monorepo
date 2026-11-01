import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TextLink } from "./text-link.js";

describe("TextLink", () => {
  it("is an ink, underlined link on a plain anchor by default", () => {
    render(<TextLink href="/sales">Current auctions</TextLink>);
    const link = screen.getByRole("link", { name: "Current auctions" });
    expect(link).toHaveAttribute("href", "/sales");
    expect(link.className).toContain("underline");
    expect(link.className).toContain("text-lax-fg");
    expect(link.className).toContain("lax-focus");
  });

  it("adds a decorative chevron on request and passes anchor attributes through", () => {
    render(
      <TextLink href="/archive" chevron target="_blank" rel="noopener">
        View all
      </TextLink>,
    );
    const link = screen.getByRole("link", { name: "View all" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps the caller's class after the kit's", () => {
    render(
      <TextLink href="/x" className="w-fit">
        Go
      </TextLink>,
    );
    expect(screen.getByRole("link").className).toContain("w-fit");
  });
});
