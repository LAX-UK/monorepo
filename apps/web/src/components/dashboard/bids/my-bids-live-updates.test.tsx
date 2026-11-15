import type { LotRealtimeCallbacks, LotRealtimePort } from "@/lib/realtime/contracts";
import {
  encodeLotExtendedRedisMessage,
  lotLiveDeliveries,
  parseLotRealtimeRedisMessage,
} from "@auction/validators";
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MyBidsLiveUpdates } from "./my-bids-live-updates";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

describe("MyBidsLiveUpdates", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    refresh.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("refetches the list when staff move a listed lot's close, earlier as well as later", () => {
    const callbacks: Record<string, LotRealtimeCallbacks> = {};
    const realtime: LotRealtimePort = {
      subscribeToLot: (lotId, cb) => {
        callbacks[lotId] = cb;
        return () => undefined;
      },
      leaveLot: () => undefined,
    } as LotRealtimePort;
    render(
      <MyBidsLiveUpdates
        userId="u1"
        lots={[{ lotId: "lot-1", lotLabel: "14", title: "Estuary" }]}
        realtime={realtime}
      />,
    );
    const message = parseLotRealtimeRedisMessage(
      JSON.parse(
        encodeLotExtendedRedisMessage({
          lotId: "lot-1",
          newEndTime: "2026-11-15T17:50:00.000Z",
          changedAt: "2026-11-15T17:40:00.000Z",
        }),
      ),
    );
    if (!message) throw new Error("expected a lot message");
    const [delivery] = lotLiveDeliveries(message, new Date("2026-11-15T17:40:00.020Z"));
    callbacks["lot-1"]?.onLotExtended?.(delivery?.payload as never);
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(600);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
