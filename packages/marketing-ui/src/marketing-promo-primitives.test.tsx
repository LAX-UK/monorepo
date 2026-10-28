import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingFeatureGrid } from "./marketing-feature-grid.js";
import { MarketingSplitFeature } from "./marketing-split-feature.js";
import { MarketingVenueCard } from "./marketing-venue-card.js";

describe("MarketingSplitFeature", () => {
  it("labels the section by its heading and renders eyebrow, body and action", () => {
    render(
      <MarketingSplitFeature
        eyebrow="Guide"
        title="Finding your way into art."
        body="How to look at art."
        action={<a href="/guide">Explore the guide</a>}
        media={<img src="/x.jpg" alt="" />}
        mediaSide="left"
      />,
    );

    const region = screen.getByRole("region", { name: "Finding your way into art." });
    expect(within(region).getByRole("heading", { level: 2 })).toBeInTheDocument();
    expect(region).toHaveTextContent("Guide");
    expect(region).toHaveTextContent("How to look at art.");
    expect(within(region).getByRole("link", { name: "Explore the guide" })).toHaveAttribute(
      "href",
      "/guide",
    );
    expect(region).toHaveAttribute("data-media-side", "left");
    expect(region.className).toContain("md:grid-cols-2");
    expect(region.className).toContain("--color-surface-feature");
  });

  it("collapses to a single text panel without media and applies the inverse tone", () => {
    render(<MarketingSplitFeature title="Press" tone="inverse" headingLevel="h3" />);

    const region = screen.getByRole("region", { name: "Press" });
    expect(screen.getByRole("heading", { level: 3, name: "Press" })).toBeInTheDocument();
    expect(region).not.toHaveAttribute("data-media-side");
    expect(region.className).not.toContain("md:grid-cols-2");
    expect(region.className).toContain("--color-surface-inverse");
  });

  it("centres the copy and its action when there is no media, so no half is left empty", () => {
    render(
      <MarketingSplitFeature
        title="Finding your way into art"
        action={<a href="/guide">Explore the guide</a>}
      />,
    );

    const region = screen.getByRole("region", { name: "Finding your way into art" });
    const panel = region.firstElementChild as HTMLElement;
    expect(panel.className).toContain("items-center");
    expect(panel.className).toContain("text-center");
    const link = within(region).getByRole("link", { name: "Explore the guide" });
    expect(link.parentElement?.className).toContain("justify-center");
  });
});

describe("MarketingVenueCard", () => {
  it("links the whole card and lists non-empty address lines", () => {
    render(
      <MarketingVenueCard
        href="/visit/marylebone"
        name="Marylebone"
        addressLines={["156 New Cavendish Street", "", "London W1W 6YW"]}
        image={<img src="/venue.jpg" alt="" />}
      />,
    );

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/visit/marylebone");
    expect(within(link).getByRole("heading", { level: 3, name: "Marylebone" })).toBeVisible();
    const address = link.querySelector("address");
    expect(address?.children).toHaveLength(2);
    expect(address).toHaveTextContent("156 New Cavendish Street");
    expect(address).toHaveTextContent("London W1W 6YW");
  });

  it("omits the address block when there are no lines", () => {
    render(<MarketingVenueCard href="/visit/soho" name="Soho" addressLines={[]} image={null} />);

    expect(screen.getByRole("link").querySelector("address")).toBeNull();
  });

  it("lays a single gallery out wide, with a visible cue inside the one link", () => {
    render(
      <MarketingVenueCard
        href="/visit/marylebone"
        name="Marylebone"
        addressLines={["156 New Cavendish Street"]}
        image={null}
        layout="wide"
        cta="Plan your visit"
      />,
    );

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("data-layout", "wide");
    expect(link.className).toContain("md:grid-cols-[7fr_5fr]");
    expect(link).toHaveTextContent("Plan your visit");
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});

describe("MarketingFeatureGrid", () => {
  const renderGrid = (variant: "lead-plus-row" | "lead-plus-stack", labels: string[]) =>
    render(
      <MarketingFeatureGrid
        variant={variant}
        aria-label="Grid"
        items={labels}
        getKey={(label) => label}
        renderItem={(label, role) => <p data-role={role}>{label}</p>}
      />,
    );

  const roles = () =>
    within(screen.getByRole("list", { name: "Grid" }))
      .getAllByRole("listitem")
      .map((item) => item.querySelector("p")?.dataset.role);

  it("puts the lead first across the row, with three items under it", () => {
    renderGrid("lead-plus-row", ["Lead", "One", "Two", "Three"]);
    const list = screen.getByRole("list", { name: "Grid" });
    const items = within(list).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual(["Lead", "One", "Two", "Three"]);
    expect(list).toHaveAttribute("data-layout", "lead-plus-row");
    expect(items[0]?.className).toContain("lg:col-span-3");
    expect(roles()).toEqual(["feature", "item", "item", "item"]);
  });

  it("spans the lead across the two stacked rows", () => {
    renderGrid("lead-plus-stack", ["Lead", "One", "Two"]);
    const list = screen.getByRole("list", { name: "Grid" });
    expect(list).toHaveAttribute("data-variant", "lead-plus-stack");
    expect(within(list).getAllByRole("listitem")[0]?.className).toContain("lg:row-span-2");
    expect(roles()).toEqual(["lead", "item", "item"]);
  });

  it("puts two items side by side instead of a lead and one small card", () => {
    renderGrid("lead-plus-row", ["Lead", "One"]);
    expect(screen.getByRole("list", { name: "Grid" })).toHaveAttribute("data-layout", "pair");
    expect(roles()).toEqual(["item", "item"]);
  });

  it("gives a single item the full width", () => {
    renderGrid("lead-plus-stack", ["Lead"]);
    expect(screen.getByRole("list", { name: "Grid" })).toHaveAttribute("data-layout", "feature");
    expect(roles()).toEqual(["solo"]);
  });

  it("renders nothing without items", () => {
    const { container } = renderGrid("lead-plus-row", []);
    expect(container).toBeEmptyDOMElement();
  });
});
