import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingFeatureCard } from "./marketing-feature-card.js";

describe("MarketingFeatureCard", () => {
  it("links the title, shows body and the default CTA label for the split variant", () => {
    const { container } = render(
      <MarketingFeatureCard
        title="Art advisory"
        body="Guidance that fits your interests."
        href="/collector-hub/art-advisory"
        media={<img src="/a.jpg" alt="" />}
      />,
    );
    expect(screen.getByRole("link", { name: "Art advisory" })).toHaveAttribute(
      "href",
      "/collector-hub/art-advisory",
    );
    expect(screen.getByText("Guidance that fits your interests.")).toBeVisible();
    expect(screen.getByText("Learn more")).toBeInTheDocument();
    expect(container.querySelector("article")).toHaveAttribute("data-variant", "split");
    expect(container.querySelector("img")).not.toBeNull();
  });

  it("uses a custom CTA label", () => {
    render(<MarketingFeatureCard title="Sell" href="/sell" ctaLabel="Find out more" />);
    expect(screen.getByText("Find out more")).toBeInTheDocument();
  });

  it("renders plain text without a link or affordance when there is no href", () => {
    render(<MarketingFeatureCard title="Private sales" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByText("Learn more")).toBeNull();
    expect(screen.getByRole("heading", { name: "Private sales" })).toBeVisible();
  });

  it("drops media for the text variant", () => {
    const { container } = render(
      <MarketingFeatureCard variant="text" title="Services" media={<img src="/a.jpg" alt="" />} />,
    );
    expect(container.querySelector("img")).toBeNull();
  });

  it("keeps media for the vertical variant", () => {
    const { container } = render(
      <MarketingFeatureCard
        variant="vertical"
        title="Owners"
        media={<img src="/a.jpg" alt="" />}
      />,
    );
    expect(container.querySelector("article")).toHaveAttribute("data-variant", "vertical");
    expect(container.querySelector("img")).not.toBeNull();
  });
});
