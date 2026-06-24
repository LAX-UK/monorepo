import { MarketingLiveConnectivityBanner } from "@/components/realtime/marketing-live-connectivity-banner";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/connection/use-browser-online", () => ({
  useBrowserOnline: vi.fn(() => true),
}));

vi.mock("@/lib/connection/use-live-connection-presentation", () => ({
  useLiveConnectionPresentation: () => ({
    state: "offline",
    message: "No connection — saleroom updates are paused.",
  }),
}));

import { useBrowserOnline } from "@/lib/connection/use-browser-online";

describe("MarketingLiveConnectivityBanner", () => {
  it("renders a fixed-top banner when enabled and connectivity is degraded", () => {
    render(<MarketingLiveConnectivityBanner enabled />);
    expect(screen.getByTestId("marketing-live-connectivity-banner")).toHaveTextContent(
      "No connection — saleroom updates are paused.",
    );
  });

  it("renders nothing when disabled", () => {
    const { container } = render(<MarketingLiveConnectivityBanner enabled={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the browser is offline", () => {
    vi.mocked(useBrowserOnline).mockReturnValue(false);
    const { container } = render(<MarketingLiveConnectivityBanner enabled />);
    expect(container).toBeEmptyDOMElement();
  });
});
