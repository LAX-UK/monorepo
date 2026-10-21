import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { MarketingPageTitle } from "./marketing-page-title.js";

vi.mock("next/image", () => ({
  default: ({
    fill: _fill,
    priority,
    sizes: _sizes,
    ...props
  }: ComponentProps<"img"> & { fill?: boolean; priority?: boolean; sizes?: string }) => (
    // biome-ignore lint/a11y/useAltText: alt is supplied by the component under test.
    <img {...props} data-priority={priority ? "true" : "false"} />
  ),
}));

describe("MarketingPageTitle", () => {
  it("renders a plain band with the h1, subtitle and a linked chip", () => {
    const { container } = render(
      <MarketingPageTitle
        title="Understand Art"
        subtitle="A growing series of guides."
        chip={{ label: "Collecting guide", href: "/collector-hub" }}
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Understand Art" })).toBeVisible();
    expect(screen.getByText("A growing series of guides.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Collecting guide" })).toHaveAttribute(
      "href",
      "/collector-hub",
    );
    expect(container.querySelector("header")).toHaveAttribute("data-variant", "plain");
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders a static chip when it has no href and omits empty optional parts", () => {
    render(
      <MarketingPageTitle title="Contact" eyebrow={null} subtitle="" chip={{ label: "Tag" }} />,
    );
    expect(screen.getByText("Tag").tagName).toBe("SPAN");
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getAllByText(/./)).toHaveLength(2);
  });

  it("renders the media variant with image, scrim, eyebrow and meta lines", () => {
    const { container } = render(
      <MarketingPageTitle
        variant="media"
        title="Fragments of a Familiar World"
        eyebrow="Closed"
        image={{ src: "https://cdn.example.com/cover.jpg" }}
        priority
        meta={["Exhibition · 18 Aug – 27 Aug 2026", " "]}
      />,
    );
    const header = container.querySelector("header");
    expect(header).toHaveAttribute("data-variant", "media");
    expect(header?.className).toContain("var(--color-hero-foreground");
    expect(screen.getByText("Closed")).toBeVisible();
    expect(screen.getByText("Exhibition · 18 Aug – 27 Aug 2026")).toBeVisible();
    const image = container.querySelector("img");
    expect(image).toHaveAttribute("alt", "");
    expect(image).toHaveAttribute("data-priority", "true");
    expect(header?.querySelector('[class*="--color-scrim-page-title"]')).toHaveAttribute(
      "aria-hidden",
    );
  });

  it("renders actions under the text", () => {
    render(
      <MarketingPageTitle title="Claude Monet" actions={<button type="button">Follow</button>} />,
    );
    expect(screen.getByRole("button", { name: "Follow" })).toBeVisible();
  });
});
