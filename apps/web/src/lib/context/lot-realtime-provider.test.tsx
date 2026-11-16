import { LotPortsProvider } from "@/lib/context/lot-ports";
import { LotRealtimeProvider } from "@/lib/context/lot-realtime-provider";
import type { AbsenteeBidWriter, BidWriter } from "@/lib/data/contracts";
import { resetEndedLots, useEndedLotIds } from "@/lib/navigation/ended-lots";
import type {
  LotRealtimeCallbacks,
  LotRealtimePort,
  RealtimeHealthPort,
} from "@/lib/realtime/contracts";
import type { LotEndedEvent } from "@auction/types";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

/** A realtime port the test drives by hand, in place of the tab's socket. */
function fakeRealtime() {
  const subscribers = new Map<string, LotRealtimeCallbacks>();
  const port: LotRealtimePort = {
    subscribeToLot(lotId, callbacks) {
      subscribers.set(lotId, callbacks);
      return () => subscribers.delete(lotId);
    },
    leaveLot() {},
  };
  const endLot = (subscribedTo: string, event: Partial<LotEndedEvent> & { lotId: string }) =>
    act(() => {
      subscribers.get(subscribedTo)?.onLotEnded?.({
        type: "lot_ended",
        currentPrice: "100.00",
        status: "sold",
        ...event,
      });
    });
  return { port, endLot };
}

let ended: ReadonlySet<string> = new Set();
function EndedProbe() {
  ended = useEndedLotIds();
  return null;
}

function renderLot(lotId: string, realtime: LotRealtimePort) {
  return render(
    <LotPortsProvider
      realtime={realtime}
      bidWriter={{} as BidWriter}
      absenteeBidWriter={{} as AbsenteeBidWriter}
      health={{} as RealtimeHealthPort}
    >
      <LotRealtimeProvider lotId={lotId}>
        <EndedProbe />
      </LotRealtimeProvider>
    </LotPortsProvider>,
  );
}

beforeEach(() => {
  resetEndedLots();
  ended = new Set();
});

describe("LotRealtimeProvider and the ended-lots store", () => {
  it("marks the lot ended when its lotEnded arrives", () => {
    const { port, endLot } = fakeRealtime();
    renderLot("lot-1", port);
    expect(ended.has("lot-1")).toBe(false);

    endLot("lot-1", { lotId: "lot-1" });

    expect(ended.has("lot-1")).toBe(true);
  });

  it("ignores a lotEnded that names another lot", () => {
    const { port, endLot } = fakeRealtime();
    renderLot("lot-1", port);

    // The socket is shared by the tab, so another room's close can reach this listener.
    endLot("lot-1", { lotId: "lot-2" });

    expect(ended.size).toBe(0);
  });
});
