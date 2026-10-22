import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingStepCard } from "./marketing-step-card.js";

describe("MarketingStepCard", () => {
  it("numbers the heading and lists links and footer", () => {
    render(
      <MarketingStepCard
        step={2}
        title="Enquire about an artwork"
        links={[{ label: "How do I enquire?", href: "/contact" }]}
        footer="Need further help?"
      >
        <p>Use the enquiry button.</p>
      </MarketingStepCard>,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "2. Enquire about an artwork" }),
    ).toBeVisible();
    expect(screen.getByText("Use the enquiry button.")).toBeVisible();
    expect(screen.getByRole("link", { name: "How do I enquire?" })).toHaveAttribute(
      "href",
      "/contact",
    );
    expect(screen.getByText("Need further help?")).toBeVisible();
  });

  it("omits the link list when there are no links", () => {
    render(<MarketingStepCard step={1} title="Create your account" />);
    expect(screen.queryByRole("list")).toBeNull();
  });
});
