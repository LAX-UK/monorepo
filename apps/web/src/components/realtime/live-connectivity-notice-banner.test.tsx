import { LiveConnectivityNoticeBanner } from "@/components/realtime/live-connectivity-notice-banner";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/connection/use-browser-online", () => ({
  useBrowserOnline: vi.fn(() => true),
}));

vi.mock("@/lib/connection/live-connectivity-notice", () => ({
  useLiveConnectivityNoticesOptional: () => [
    {
      id: "saleroom-hydrate-failed-sale-1",
      message: "Could not refresh saleroom status — on-block lot info may be stale.",
    },
  ],
}));

import { useBrowserOnline } from "@/lib/connection/use-browser-online";

describe("LiveConnectivityNoticeBanner", () => {
  it("renders a scoped hydrate notice", () => {
    render(<LiveConnectivityNoticeBanner scope="saleroom" testId="staff-notice-banner" />);
    expect(screen.getByTestId("staff-notice-banner")).toHaveTextContent(
      "Could not refresh saleroom status",
    );
  });

  it("renders nothing when the browser is offline", () => {
    vi.mocked(useBrowserOnline).mockReturnValue(false);
    const { container } = render(
      <LiveConnectivityNoticeBanner scope="saleroom" testId="staff-notice-banner" />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
