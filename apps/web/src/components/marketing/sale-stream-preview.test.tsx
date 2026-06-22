import { SaleStreamPreview } from "@/components/marketing/sale-stream-preview";
import { resolveSaleStreamContext } from "@/lib/sale-stream-policy";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

const livePres = resolveSaleStreamContext({
  streamUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
  status: "active",
  deliveryMode: "hybrid",
  saleTitle: "Evening Sale",
}).presentation;

const recordingPres = resolveSaleStreamContext({
  streamUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
  status: "ended",
  deliveryMode: "onsite",
  saleTitle: "Evening Sale",
}).presentation;

describe("SaleStreamPreview", () => {
  it("renders click-to-load embed for YouTube URLs (live phase)", () => {
    render(
      <SaleStreamPreview
        streamUrl="https://www.youtube.com/watch?v=jNQXAC9IVRw"
        saleTitle="Evening Sale"
        posterUrl="/poster.jpg"
        presentation={livePres}
      />,
    );
    expect(screen.getByRole("button", { name: /watch live/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open in youtube/i })).toHaveAttribute(
      "href",
      "https://www.youtube.com/watch?v=jNQXAC9IVRw",
    );
  });

  it("loads iframe after Watch live is clicked and title uses live prefix", () => {
    render(
      <SaleStreamPreview
        streamUrl="https://www.youtube.com/watch?v=jNQXAC9IVRw"
        saleTitle="Evening Sale"
        presentation={livePres}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /watch live/i }));
    expect(screen.getByTitle("Live stream: Evening Sale")).toHaveAttribute(
      "src",
      expect.stringContaining("youtube.com/embed/jNQXAC9IVRw"),
    );
  });

  it("recording phase — shows Watch recording CTA and Saleroom recording iframe title", () => {
    render(
      <SaleStreamPreview
        streamUrl="https://www.youtube.com/watch?v=jNQXAC9IVRw"
        saleTitle="Evening Sale"
        presentation={recordingPres}
      />,
    );
    expect(screen.getByRole("button", { name: /watch recording/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /watch recording/i }));
    expect(screen.getByTitle("Saleroom recording: Evening Sale")).toBeTruthy();
  });

  it("falls back to external link when URL is not embeddable (no presentation)", () => {
    render(<SaleStreamPreview streamUrl="https://example.com/watch" saleTitle="Evening Sale" />);
    expect(screen.queryByRole("button", { name: /watch live/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open live stream/i })).toHaveAttribute(
      "href",
      "https://example.com/watch",
    );
  });

  it("falls back with recording-phase external link label for non-embeddable recording URL", () => {
    render(
      <SaleStreamPreview
        streamUrl="https://example.com/watch"
        saleTitle="Evening Sale"
        presentation={recordingPres}
      />,
    );
    expect(screen.getByRole("link", { name: /open recording/i })).toBeInTheDocument();
  });
});
