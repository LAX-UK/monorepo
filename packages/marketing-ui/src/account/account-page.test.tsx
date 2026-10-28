import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AccountArea } from "./account-area";
import { AccountPage } from "./account-page";

describe("AccountPage", () => {
  it("renders the title as the page heading with its description, action and tabs", () => {
    render(
      <AccountPage
        title="My bids"
        description="Your bids in current and past sales."
        action={<a href="/sales">Browse upcoming sales</a>}
        tabs={<div role="tablist" aria-label="Bids" />}
      >
        <p>Rows</p>
      </AccountPage>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "My bids" })).toBeInTheDocument();
    expect(screen.getByText("Your bids in current and past sales.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse upcoming sales" })).toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "Bids" })).toBeInTheDocument();
    expect(screen.getByText("Rows")).toBeInTheDocument();
  });

  it("leaves out the optional parts when a page has none", () => {
    const { container } = render(
      <AccountPage title="Watching">
        <p>Rows</p>
      </AccountPage>,
    );
    expect(container.querySelector("[data-account-page-action]")).toBeNull();
    expect(container.querySelector("[data-account-page-tabs]")).toBeNull();
    expect(container.querySelector("p")?.textContent).toBe("Rows");
  });
});

describe("AccountArea", () => {
  it("puts the sub-navigation before the main landmark", () => {
    render(
      <AccountArea subNav={<nav aria-label="Your account" />}>
        <p>Page</p>
      </AccountArea>,
    );
    const nav = screen.getByRole("navigation", { name: "Your account" });
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main-content");
    expect(nav.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
