import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AccountViewTabs } from "./account-view-tabs";

const TABS = [
  { id: "active", label: "Active", href: "/bids", count: 3 },
  { id: "won", label: "Won", href: "/bids?tab=won", count: 0 },
  { id: "lost", label: "Not won", href: "/bids?tab=lost" },
];

describe("AccountViewTabs", () => {
  it("names the views and marks only the one in use", () => {
    render(<AccountViewTabs label="Bids" tabs={TABS} currentId="won" />);
    const nav = screen.getByRole("navigation", { name: "Bids" });
    expect(within(nav).getByRole("link", { name: /^Won/ })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: /^Active/ })).not.toHaveAttribute("aria-current");
  });

  it("reads each count with its meaning and leaves it out when unknown", () => {
    render(<AccountViewTabs label="Bids" tabs={TABS} currentId="active" />);
    expect(screen.getByRole("link", { name: /^Active\W+3$/ })).toHaveAttribute("href", "/bids");
    expect(screen.getByRole("link", { name: /^Won\W+0$/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Not won" })).toBeInTheDocument();
  });
});
