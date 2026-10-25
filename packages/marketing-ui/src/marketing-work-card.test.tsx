import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingWorkCard, MarketingWorkGrid } from "./marketing-work-card.js";

describe("MarketingWorkCard footer", () => {
  it("pins the note and the footer together at the bottom, the note first and quieter", () => {
    render(
      <MarketingWorkCard
        href="/artworks/reed-study"
        title="Reed Study"
        media={<img src="/x.webp" alt="" />}
        subtitle={<span>Elias Moore</span>}
        footerNote={<p>Limited edition of 24</p>}
        footer={<p>£95.00</p>}
      />,
    );
    const note = screen.getByText("Limited edition of 24").closest("[data-slot='footer-note']");
    const footer = screen.getByText("£95.00").closest("[data-slot='footer']");
    expect(note).not.toBeNull();
    expect(footer).not.toBeNull();
    // One bottom block holds both, so they line up across a row.
    expect(note?.parentElement).toBe(footer?.parentElement);
    expect(note?.parentElement?.className).toContain("mt-auto");
    expect(note?.className).toContain("text-on-surface-variant");
    expect(footer?.className).toContain("font-medium");
    if (!note || !footer) throw new Error("footer slots missing");
    expect(note.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The artist stays directly under the title, outside the pinned block.
    expect(screen.getByText("Elias Moore").closest("[data-slot='footer-note']")).toBeNull();
  });

  it("renders no bottom block when there is nothing to pin", () => {
    const { container } = render(
      <MarketingWorkCard href="/w" title="Work" media={<img src="/x.webp" alt="" />} />,
    );
    expect(container.querySelector("[data-slot='footer']")).toBeNull();
    expect(container.querySelector(".mt-auto")).toBeNull();
  });
});

describe("MarketingWorkGrid", () => {
  it("keeps every card full height through the reveal wrapper so footers share a row edge", () => {
    const { container } = render(
      <MarketingWorkGrid>
        <MarketingWorkCard key="a" href="/a" title="A" media={<img src="/a.webp" alt="" />} />
      </MarketingWorkGrid>,
    );
    const inner = container.querySelector(".reveal__inner");
    expect(inner?.className).toContain("h-full");
    expect(inner?.parentElement?.className).toContain("h-full");
  });
});
