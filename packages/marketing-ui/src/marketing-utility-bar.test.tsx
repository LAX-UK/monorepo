import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingUtilityBar } from "./marketing-utility-bar.js";

const ITEMS = [
  { label: "LAX.ART", href: "/", current: true },
  { label: "LAX.BID", href: "https://bid.example/" },
];

describe("MarketingUtilityBar", () => {
  it("renders only the utility landmark when no trailing actions are given", () => {
    const { container } = render(<MarketingUtilityBar items={ITEMS} />);
    expect(container.firstElementChild?.tagName).toBe("NAV");
    expect(screen.getByRole("link", { name: "LAX.ART" })).toHaveAttribute("aria-current", "page");
  });

  it("places trailing actions after the utility landmark, outside it", () => {
    render(<MarketingUtilityBar items={ITEMS} trailing={<a href="/login">Log in</a>} />);
    const nav = screen.getByRole("navigation", { name: "Utility" });
    const login = screen.getByRole("link", { name: "Log in" });
    expect(nav).not.toContainElement(login);
    expect(nav.compareDocumentPosition(login) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
