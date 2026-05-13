import { LotPortsProvider } from "@/lib/context/lot-ports";
import type { RealtimeHealthPort } from "@/lib/realtime/contracts";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useRealtimeLatency } from "./use-realtime-latency";

function ProbeConsumer() {
  const s = useRealtimeLatency();
  return <span data-testid="state">{s.state}</span>;
}

function makeFakeHealth(overrides?: Partial<RealtimeHealthPort>): RealtimeHealthPort {
  return {
    subscribe(l) {
      l({
        state: "online",
        rttMs: 55,
        lastSampleAt: Date.now(),
        lastBidPropagationMs: null,
      });
      return () => {};
    },
    probe: () => {},
    setBidPropagationLotId: () => {},
    ...overrides,
  };
}

describe("useRealtimeLatency", () => {
  it("reflects health port subscribe pushes", async () => {
    const health = makeFakeHealth();
    render(
      <LotPortsProvider health={health}>
        <ProbeConsumer />
      </LotPortsProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("state")).toHaveTextContent("online");
    });
  });
});
