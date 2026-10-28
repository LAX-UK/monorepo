import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AccountSubNav } from "./account-sub-nav";
import { accountSubNavCountText, visibleAccountSubNavCount } from "./account-sub-nav-count";

const ITEMS = [
  {
    id: "bids",
    label: "My bids",
    href: "/bids",
    count: { value: 1, tone: "danger" as const, label: "1 outbid" },
  },
  {
    id: "purchases",
    label: "Purchases",
    href: "/purchases",
    count: { value: 0, tone: "neutral" as const, label: "none to pay" },
  },
  { id: "watching", label: "Watching", href: "/watching" },
];

describe("AccountSubNav", () => {
  it("names the band and marks only the current page", () => {
    render(<AccountSubNav label="Your account" items={ITEMS} currentId="purchases" />);
    const nav = screen.getByRole("navigation", { name: "Your account" });
    expect(within(nav).getByRole("link", { name: "Purchases" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("link", { name: /My bids/ })).not.toHaveAttribute("aria-current");
  });

  it("shows a count only where something is due, read out with its meaning", () => {
    render(<AccountSubNav label="Your account" items={ITEMS} currentId={null} />);
    expect(screen.getByRole("link", { name: /My bids.*1 outbid/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Purchases" })).toBeInTheDocument();
  });
});

describe("sub-navigation counts", () => {
  it("caps large numbers", () => {
    expect(accountSubNavCountText(3)).toBe("3");
    expect(accountSubNavCountText(12)).toBe("9+");
  });

  it("hides empty counts", () => {
    expect(visibleAccountSubNavCount(null)).toBeNull();
    expect(visibleAccountSubNavCount({ value: 0, tone: "neutral", label: "" })).toBeNull();
    expect(visibleAccountSubNavCount({ value: 2, tone: "danger", label: "2 outbid" })?.value).toBe(
      2,
    );
  });
});
