import { SaleStreamPreview } from "@/components/marketing/sale-stream-preview";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("SaleStreamPreview", () => {
  it("renders click-to-load embed for YouTube URLs", () => {
    render(
      <SaleStreamPreview
        streamUrl="https://www.youtube.com/watch?v=jNQXAC9IVRw"
        saleTitle="Evening Sale"
        posterUrl="/poster.jpg"
      />,
    );
    expect(screen.getByRole("button", { name: /watch live/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open in youtube/i })).toHaveAttribute(
      "href",
      "https://www.youtube.com/watch?v=jNQXAC9IVRw",
    );
  });

  it("loads iframe after Watch live is clicked", () => {
    render(
      <SaleStreamPreview
        streamUrl="https://www.youtube.com/watch?v=jNQXAC9IVRw"
        saleTitle="Evening Sale"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /watch live/i }));
    expect(screen.getByTitle("Live stream: Evening Sale")).toHaveAttribute(
      "src",
      expect.stringContaining("youtube.com/embed/jNQXAC9IVRw"),
    );
  });

  it("falls back to external link when URL is not embeddable", () => {
    render(<SaleStreamPreview streamUrl="https://example.com/watch" saleTitle="Evening Sale" />);
    expect(screen.queryByRole("button", { name: /watch live/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open live stream/i })).toHaveAttribute(
      "href",
      "https://example.com/watch",
    );
  });
});
