import { ConnectionStatusBanner } from "@/components/realtime/connection-status-banner";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("ConnectionStatusBanner", () => {
  it("renders nothing when live", () => {
    const { container } = render(<ConnectionStatusBanner state="live" message={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders offline message", () => {
    render(
      <ConnectionStatusBanner
        state="offline"
        message="No connection — live bidding is paused. Prices may be outdated."
      />,
    );
    expect(screen.getByTestId("connection-status-banner")).toHaveTextContent("No connection");
  });

  it("renders connecting message", () => {
    render(<ConnectionStatusBanner state="connecting" message="Reconnecting to the saleroom…" />);
    expect(screen.getByTestId("connection-status-banner")).toHaveTextContent("Reconnecting");
  });
});
