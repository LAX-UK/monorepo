import type { ConnectionStatus } from "@/lib/realtime/contracts";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LatencyBadge } from "./latency-badge";

function status(partial: Partial<ConnectionStatus>): ConnectionStatus {
  return {
    state: "connecting",
    rttMs: null,
    lastSampleAt: null,
    lastBidPropagationMs: null,
    ...partial,
  };
}

describe("LatencyBadge", () => {
  it("renders nothing until first RTT sample (non-offline)", () => {
    const { container } = render(
      <LatencyBadge status={status({ state: "online", rttMs: null })} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders offline label without RTT", () => {
    render(<LatencyBadge status={status({ state: "offline", rttMs: null })} />);
    expect(screen.getByText("Offline")).toBeInTheDocument();
  });

  it("renders rounded RTT when online", () => {
    render(
      <LatencyBadge status={status({ state: "online", rttMs: 42.7, lastSampleAt: Date.now() })} />,
    );
    expect(screen.getByTestId("latency-badge")).toHaveTextContent("43 ms");
  });
});
