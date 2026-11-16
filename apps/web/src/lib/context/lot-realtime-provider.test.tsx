import { LotPortsProvider } from "@/lib/context/lot-ports";
import { LotRealtimeProvider, useLotRealtimeContext } from "@/lib/context/lot-realtime-provider";
import type { AbsenteeBidWriter, BidWriter } from "@/lib/data/contracts";
import { resetEndedLots, useEndedLotIds } from "@/lib/navigation/ended-lots";
import type {
  LotRealtimeCallbacks,
  LotRealtimePort,
  RealtimeHealthPort,
} from "@/lib/realtime/contracts";
import type { LotEndedEvent } from "@auction/types";
import { act, render } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it } from "vitest";

/** A realtime port the test drives by hand, in place of the tab's socket. */
function fakeRealtime() {
  const subscribers = new Map<string, LotRealtimeCallbacks>();
  const port: LotRealtimePort & { reconnect: () => void } = {
    reconnect() {
      for (const callbacks of subscribers.values()) callbacks.onReconnect?.();
    },
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

  it("marks the lot the event names, not the page's own lot", () => {
    const { port, endLot } = fakeRealtime();
    renderLot("lot-1", port);

    // The socket is shared by the tab, so another room's close can reach this listener.
    endLot("lot-1", { lotId: "lot-2" });

    expect([...ended]).toEqual(["lot-2"]);
  });
});

describe("LotRealtimeProvider fan-out", () => {
  it("relays every socket callback to each registered listener", () => {
    const { port, endLot } = fakeRealtime();
    const heard: string[] = [];
    function Listener({ name }: { name: string }) {
      const ctx = useLotRealtimeContext();
      useEffect(
        () =>
          ctx?.register({
            onLotEnded: (e) => heard.push(`${name}:ended:${e.lotId}`),
            onReconnect: () => heard.push(`${name}:reconnect`),
          }),
        [ctx, name],
      );
      return null;
    }
    render(
      <LotPortsProvider
        realtime={port}
        bidWriter={{} as BidWriter}
        absenteeBidWriter={{} as AbsenteeBidWriter}
        health={{} as RealtimeHealthPort}
      >
        <LotRealtimeProvider lotId="lot-1">
          <Listener name="a" />
          <Listener name="b" />
        </LotRealtimeProvider>
      </LotPortsProvider>,
    );

    endLot("lot-1", { lotId: "lot-1" });
    act(() => port.reconnect());

    expect(heard).toEqual(["a:ended:lot-1", "b:ended:lot-1", "a:reconnect", "b:reconnect"]);
  });
});
