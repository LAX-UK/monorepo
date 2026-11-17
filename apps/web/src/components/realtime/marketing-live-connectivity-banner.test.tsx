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

const observed: Element[] = [];
let resize: (height: number) => void = () => {};
vi.stubGlobal(
  "ResizeObserver",
  class {
    constructor(private readonly cb: () => void) {}
    observe(el: HTMLElement) {
      observed.push(el);
      resize = (height) => {
        Object.defineProperty(el, "offsetHeight", { configurable: true, value: height });
        this.cb();
      };
    }
    disconnect() {}
  },
);

describe("MarketingLiveConnectivityBanner", () => {
  it("renders the banner when enabled and connectivity is degraded", () => {
    render(<MarketingLiveConnectivityBanner enabled />);
    expect(screen.getByTestId("marketing-live-connectivity-banner")).toHaveTextContent(
      "No connection — saleroom updates are paused.",
    );
  });

  it("keeps status semantics and publishes its height into the header offset while shown", () => {
    const { unmount } = render(<MarketingLiveConnectivityBanner enabled />);
    const banner = screen.getByTestId("marketing-live-connectivity-banner");
    expect(banner).toHaveAttribute("role", "status");
    expect(banner).toHaveAttribute("aria-live", "polite");
    expect(observed).toContain(banner);
    resize(31);
    const root = document.documentElement.style;
    expect(root.getPropertyValue("--connectivity-banner-height")).toBe("31px");
    unmount();
    expect(root.getPropertyValue("--connectivity-banner-height")).toBe("");
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
