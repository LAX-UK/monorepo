import type { Lot, SaleroomRealtimePayload } from "@auction/types";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useClerkLotRosterSync } from "./use-clerk-lot-roster-sync";

const baseLots: Lot[] = [
  {
    id: "lot-1",
    saleId: "sale-1",
    lotNumber: 1,
    title: "Lot one",
    status: "active",
    currentPrice: "100",
    winnerId: null,
  } as Lot,
  {
    id: "lot-2",
    saleId: "sale-1",
    lotNumber: 2,
    title: "Lot two",
    status: "scheduled",
    currentPrice: "0",
    winnerId: null,
  } as Lot,
];

describe("useClerkLotRosterSync", () => {
  it("patches lot status when hammer event arrives", () => {
    const { result, rerender } = renderHook(
      ({ liveFeed }: { liveFeed: SaleroomRealtimePayload[] }) =>
        useClerkLotRosterSync({ initialLots: baseLots, liveFeed }),
      {
        initialProps: { liveFeed: [] as SaleroomRealtimePayload[] },
      },
    );

    rerender({
      liveFeed: [
        {
          kind: "hammer",
          saleId: "sale-1",
          lotId: "lot-1",
          emittedAt: "2026-06-17T10:00:00.000Z",
        },
      ] satisfies SaleroomRealtimePayload[],
    });

    expect(result.current.lots.find((lot) => lot.id === "lot-1")?.status).toBe("ended");
    expect(result.current.hammeredLotIds.has("lot-1")).toBe(true);
  });

  it("activates advanced lot and clears winner on no sale", () => {
    const { result, rerender } = renderHook(
      ({ liveFeed }: { liveFeed: SaleroomRealtimePayload[] }) =>
        useClerkLotRosterSync({ initialLots: baseLots, liveFeed }),
      { initialProps: { liveFeed: [] as SaleroomRealtimePayload[] } },
    );

    act(() => {
      rerender({
        liveFeed: [
          {
            kind: "no_sale",
            saleId: "sale-1",
            lotId: "lot-1",
            emittedAt: "2026-06-17T10:00:00.000Z",
          },
          {
            kind: "advanced_to_lot",
            saleId: "sale-1",
            lotId: "lot-2",
            emittedAt: "2026-06-17T10:01:00.000Z",
          },
        ] satisfies SaleroomRealtimePayload[],
      });
    });

    expect(result.current.lots.find((lot) => lot.id === "lot-1")).toMatchObject({
      status: "ended",
      winnerId: null,
    });
    expect(result.current.lots.find((lot) => lot.id === "lot-2")?.status).toBe("active");
    expect(result.current.hammeredLotIds.has("lot-1")).toBe(false);
  });

  it("clears hammeredLotIds when initialLots refresh from the server", () => {
    const { result, rerender } = renderHook(
      ({
        initialLots,
        liveFeed,
      }: {
        initialLots: Lot[];
        liveFeed: SaleroomRealtimePayload[];
      }) => useClerkLotRosterSync({ initialLots, liveFeed }),
      {
        initialProps: {
          initialLots: baseLots,
          liveFeed: [] as SaleroomRealtimePayload[],
        },
      },
    );

    rerender({
      initialLots: baseLots,
      liveFeed: [
        {
          kind: "hammer",
          saleId: "sale-1",
          lotId: "lot-1",
          emittedAt: "2026-06-17T10:00:00.000Z",
        },
      ] satisfies SaleroomRealtimePayload[],
    });

    expect(result.current.hammeredLotIds.has("lot-1")).toBe(true);

    rerender({
      initialLots: baseLots.map((lot) =>
        lot.id === "lot-1" ? { ...lot, status: "ended", winnerId: "user-1" } : lot,
      ) as Lot[],
      liveFeed: [
        {
          kind: "hammer",
          saleId: "sale-1",
          lotId: "lot-1",
          emittedAt: "2026-06-17T10:00:00.000Z",
        },
      ] satisfies SaleroomRealtimePayload[],
    });

    expect(result.current.hammeredLotIds.size).toBe(0);
  });
});
