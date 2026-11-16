import { NO_ATTENTION } from "@/lib/navigation/client-attention";
import type { ClientAttention } from "@/lib/navigation/client-attention";
import { markLotEnded, resetEndedLots, withoutEndedLots } from "@/lib/navigation/ended-lots";
import { announceLotEnded } from "@/lib/realtime/lot-ended-signal";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useEndedLotIds } from "./ended-lots";

const item = (lotId: string, title: string) => ({
  kind: "outbid" as const,
  lotId,
  title,
  url: `/lots/${lotId}`,
});

/** Outbid on lots 3 (closes first), 7 and 9. */
const attention: ClientAttention = {
  ...NO_ATTENTION,
  outbidLots: ["3", "7", "9"],
  outbidLotIds: ["lot-3", "lot-7", "lot-9"],
  groups: [
    {
      kind: "outbid",
      count: 3,
      url: "/bids?tab=active",
      items: [item("lot-3", "Harbour"), item("lot-7", "Estuary"), item("lot-9", "Dunes")],
    },
  ],
};

beforeEach(() => resetEndedLots());

describe("withoutEndedLots", () => {
  it("returns the same facts when nothing it names has closed", () => {
    expect(withoutEndedLots(attention, new Set())).toBe(attention);
    expect(withoutEndedLots(attention, new Set(["lot-x"]))).toBe(attention);
  });

  it("drops the closed lot's own entry, not the last one", () => {
    const next = withoutEndedLots(attention, new Set(["lot-3"]));
    expect(next.outbidLots).toEqual(["7", "9"]);
    expect(next.outbidLotIds).toEqual(["lot-7", "lot-9"]);
    expect(next.groups[0]).toMatchObject({
      count: 2,
      items: [{ lotId: "lot-7" }, { lotId: "lot-9" }],
    });
  });

  it("drops the outbid group once every lot in it has closed", () => {
    const next = withoutEndedLots(attention, new Set(["lot-3", "lot-7", "lot-9"]));
    expect(next.outbidLots).toEqual([]);
    expect(next.groups).toEqual([]);
  });

  it("keeps an unnumbered lot's entry in line with its id", () => {
    const facts: ClientAttention = {
      ...attention,
      outbidLots: [null, "7"],
      outbidLotIds: ["lot-new", "lot-7"],
    };
    expect(withoutEndedLots(facts, new Set(["lot-7"])).outbidLots).toEqual([null]);
  });

  it("keeps the count right for facts read without lot ids", () => {
    const { outbidLotIds: _, ...facts } = attention;
    expect(withoutEndedLots(facts, new Set(["lot-3"])).outbidLots).toHaveLength(2);
  });
});

describe("the ended-lots store", () => {
  it("records a lot the lot page announces as ended", () => {
    const { result } = renderHook(() => useEndedLotIds());
    expect(result.current.size).toBe(0);
    act(() => announceLotEnded("lot-3"));
    expect([...result.current]).toEqual(["lot-3"]);
  });

  it("notifies once per lot", () => {
    const { result } = renderHook(() => useEndedLotIds());
    act(() => markLotEnded("lot-3"));
    const first = result.current;
    act(() => markLotEnded("lot-3"));
    expect(result.current).toBe(first);
  });
});
