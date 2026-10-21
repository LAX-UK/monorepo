import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingCtaBand } from "./marketing-cta-band.js";
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
});

describe("MarketingCtaBand", () => {
  it("renders a labelled band with body and action on the plain surface by default", () => {
    render(
      <MarketingCtaBand
        title="Take the conversation further"
        body="Speak with our team."
        action={<button type="button">Begin a private enquiry</button>}
      />,
    );

    const region = screen.getByRole("region", { name: "Take the conversation further" });
    expect(region).toHaveTextContent("Speak with our team.");
    expect(within(region).getByRole("button", { name: "Begin a private enquiry" })).toBeVisible();
    expect(region.className).toContain("bg-surface");
  });

  it("uses the feature surface with a fallback for themes without the token", () => {
    render(<MarketingCtaBand title="Visit" tone="feature" />);

    expect(screen.getByRole("region", { name: "Visit" }).className).toContain(
      "bg-[var(--color-surface-feature,var(--color-surface-container-low))]",
    );
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
});

describe("MarketingFeatureGrid", () => {
  it("puts the lead first and wraps each secondary item in a list item", () => {
    render(
      <MarketingFeatureGrid variant="lead-plus-row" lead={<p>Lead</p>} aria-label="What's on">
        <p key="a">One</p>
        <p key="b">Two</p>
        <p key="c">Three</p>
      </MarketingFeatureGrid>,
    );

    const list = screen.getByRole("list", { name: "What's on" });
    const items = within(list).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual(["Lead", "One", "Two", "Three"]);
    expect(items[0]?.className).toContain("lg:col-span-3");
  });

  it("spans the lead across the two stacked rows", () => {
    render(
      <MarketingFeatureGrid variant="lead-plus-stack" lead={<p>Lead</p>} aria-label="Stories">
        <p key="a">One</p>
        <p key="b">Two</p>
      </MarketingFeatureGrid>,
    );

    const list = screen.getByRole("list", { name: "Stories" });
    expect(list).toHaveAttribute("data-variant", "lead-plus-stack");
    expect(within(list).getAllByRole("listitem")[0]?.className).toContain("lg:row-span-2");
  });
});
