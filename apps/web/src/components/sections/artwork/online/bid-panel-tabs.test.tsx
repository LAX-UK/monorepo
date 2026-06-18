import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BidPanelTabs } from "./bid-panel-tabs";

describe("BidPanelTabs", () => {
  it("cycles focus and selection with arrow keys", () => {
    render(
      <BidPanelTabs
        bidPanel={<div>Bids body</div>}
        videoPanel={<div>Video body</div>}
        hasVideoStream
      />,
    );
    const bidsTab = screen.getByRole("tab", { name: /bids view/i });
    const videoTab = screen.getByRole("tab", { name: /video stream/i });
    bidsTab.focus();
    expect(bidsTab).toHaveAttribute("tabIndex", "0");
    fireEvent.keyDown(bidsTab, { key: "ArrowRight" });
    expect(videoTab).toHaveAttribute("aria-selected", "true");
    expect(videoTab).toHaveAttribute("tabIndex", "0");
    fireEvent.keyDown(videoTab, { key: "ArrowLeft" });
    expect(bidsTab).toHaveAttribute("aria-selected", "true");
  });

  it("renders bid content on both tabs (bid panel is always mounted)", () => {
    render(
      <BidPanelTabs
        bidPanel={<div data-testid="bid-panel-content">Bids body</div>}
        videoPanel={<div data-testid="video-panel-content">Video body</div>}
        hasVideoStream
      />,
    );

    // Bid content always in DOM
    expect(screen.getByTestId("bid-panel-content")).toBeInTheDocument();
    // Video content always in DOM (mounted, just hidden)
    expect(screen.getByTestId("video-panel-content")).toBeInTheDocument();
  });

  it("hides video panel on Bids View tab but keeps it in DOM", () => {
    render(
      <BidPanelTabs
        bidPanel={<div>Bids body</div>}
        videoPanel={<div data-testid="video-panel">Video body</div>}
        hasVideoStream
      />,
    );

    // Default tab is bids — video tabpanel has hidden attribute
    const videoPanel = screen.getByTestId("video-panel").parentElement;
    expect(videoPanel).toHaveAttribute("hidden");
  });

  it("shows video panel and keeps bid content when switching to Video Stream tab", () => {
    render(
      <BidPanelTabs
        bidPanel={<div data-testid="bid-content">Bids body</div>}
        videoPanel={<div data-testid="video-content">Video body</div>}
        hasVideoStream
      />,
    );

    // Switch to video tab
    fireEvent.click(screen.getByRole("tab", { name: /video stream/i }));

    const videoPanel = screen.getByTestId("video-content").parentElement;
    expect(videoPanel).not.toHaveAttribute("hidden");

    // Bid content still in DOM (not conditionally rendered)
    expect(screen.getByTestId("bid-content")).toBeInTheDocument();
  });

  it("renders only bid panel when hasVideoStream is false", () => {
    render(
      <BidPanelTabs
        bidPanel={<div>Bids body</div>}
        videoPanel={<div>Video body</div>}
        hasVideoStream={false}
      />,
    );

    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.getByText("Bids body")).toBeInTheDocument();
    expect(screen.queryByText("Video body")).not.toBeInTheDocument();
  });
});
