import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingSectionHeader } from "./marketing-section-header.js";

describe("MarketingSectionHeader", () => {
  it("keeps the action on the title's row, aligned to its last baseline, and never wrapping", () => {
    render(
      <MarketingSectionHeader
        heading={<h2>What's on across LAX</h2>}
        subtitle="Exhibitions and events"
        action={<a href="/exhibitions">View all</a>}
      />,
    );

    const row = screen.getByRole("heading", { name: "What's on across LAX" }).parentElement
      ?.parentElement as HTMLElement;
    expect(row.className).toContain("items-baseline-last");
    expect(row.className).not.toContain("flex-wrap");
    expect(row).toContainElement(screen.getByRole("link", { name: "View all" }));
    expect(screen.getByRole("link", { name: "View all" }).parentElement?.className).toContain(
      "whitespace-nowrap",
    );
  });

  it("runs the subtitle under the row, not beside the action", () => {
    render(
      <MarketingSectionHeader
        heading={<h2>Featured</h2>}
        subtitle="From the gallery"
        action={<a href="/all">View all</a>}
      />,
    );

    const row = screen.getByRole("heading", { name: "Featured" }).parentElement
      ?.parentElement as HTMLElement;
    expect(row).not.toContainElement(screen.getByText("From the gallery"));
  });
});
