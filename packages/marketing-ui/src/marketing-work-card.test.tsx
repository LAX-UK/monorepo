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

describe("MarketingWorkCard media style", () => {
  const frameOf = (container: HTMLElement) => container.querySelector("[data-media-style]");

  it("keeps the product's own mat when no style is given", () => {
    const { container } = render(
      <MarketingWorkCard href="/a" title="A" media={<img src="/x.webp" alt="" />} />,
    );
    const mat = container.querySelector(".marketing-work-mat");
    expect(mat?.className).toContain("aspect-[4/5]");
    expect(frameOf(container)).toBeNull();
  });

  it.each([
    ["wall", "aspect-[4/5]", "object-contain"],
    ["object", "aspect-[4/5]", "object-contain"],
    ["product", "aspect-square", "object-cover"],
    ["showcase", "aspect-[3/2]", "object-cover"],
    ["document", "aspect-[3/4]", "object-contain"],
  ] as const)("frames a %s lot as %s and fits its picture with %s", (style, aspect, fit) => {
    const { container } = render(
      <MarketingWorkCard
        href="/a"
        title="A"
        mediaStyle={style}
        media={<img src="/x.webp" alt="" />}
      />,
    );
    const frame = frameOf(container);
    expect(frame?.getAttribute("data-media-style")).toBe(style);
    expect(frame?.className).toContain(aspect);
    expect(container.querySelector("a > span")?.className).toContain(fit);
  });

  it("puts the wall shadow on wall works only", () => {
    const wall = render(
      <MarketingWorkCard
        href="/a"
        title="A"
        mediaStyle="wall"
        media={<img src="/x.webp" alt="" />}
      />,
    );
    expect(frameOf(wall.container)?.className).toContain("marketing-lot-wall");
    wall.unmount();
    const object = render(
      <MarketingWorkCard
        href="/a"
        title="A"
        mediaStyle="object"
        media={<img src="/x.webp" alt="" />}
      />,
    );
    expect(frameOf(object.container)?.className).not.toContain("marketing-lot-wall");
    expect(frameOf(object.container)?.className).toContain("marketing-studio-ground");
  });
});

describe("MarketingWorkCard overlay action", () => {
  it("shows a control over the mat only when given one", () => {
    const { rerender } = render(
      <MarketingWorkCard href="/a" title="Reed Study" media={<img src="/x.webp" alt="" />} />,
    );
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    rerender(
      <MarketingWorkCard
        href="/a"
        title="Reed Study"
        media={<img src="/x.webp" alt="" />}
        overlayAction={<button type="button">Save</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });
});
