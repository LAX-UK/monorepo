import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingEnquiryListItem } from "./marketing-enquiry-list-item.js";

describe("MarketingEnquiryListItem", () => {
  it("renders type, linked title, description, status and date", () => {
    render(
      <MarketingEnquiryListItem
        typeLabel="Artwork enquiry"
        title="Warm Basket"
        href="/artworks/warm-basket"
        description="Is it available?"
        status={<span>Awaiting reply</span>}
        date={<time dateTime="2026-03-01">1 Mar 2026</time>}
      />,
    );
    expect(screen.getByText("Artwork enquiry")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Warm Basket" })).toHaveAttribute(
      "href",
      "/artworks/warm-basket",
    );
    expect(screen.getByText("Is it available?")).toBeInTheDocument();
    expect(screen.getByText("Awaiting reply")).toBeInTheDocument();
    expect(screen.getByText("1 Mar 2026")).toBeInTheDocument();
  });

  it("renders a plain title without a link", () => {
    render(<MarketingEnquiryListItem typeLabel="General enquiry" title="Hello" date="today" />);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows media only in the artwork variant", () => {
    const { rerender } = render(
      <MarketingEnquiryListItem
        variant="artwork"
        typeLabel="t"
        title="x"
        date="d"
        media={<span data-testid="thumb" />}
      />,
    );
    expect(screen.getByTestId("thumb")).toBeInTheDocument();
    rerender(
      <MarketingEnquiryListItem
        variant="compact"
        typeLabel="t"
        title="x"
        date="d"
        media={<span data-testid="thumb" />}
      />,
    );
    expect(screen.queryByTestId("thumb")).toBeNull();
  });
});
