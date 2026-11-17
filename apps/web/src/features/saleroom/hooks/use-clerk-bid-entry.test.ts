import { useClerkBidEntry } from "@/features/saleroom/hooks/use-clerk-bid-entry";
import type { AdminTelephoneBookingRow } from "@/lib/data/http/admin.server";
import { notify } from "@/lib/ui/notify";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ui/notify", () => ({
  notify: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const baseRoster = [{ paddleNumber: 142, displayName: "Jane Doe" }] as const;

const telephoneBookings: AdminTelephoneBookingRow[] = [
  {
    id: "booking-1",
    saleId: "sale-1",
    userId: "user-1",
    buyerLegalEntityId: "le-1",
    userName: "Tel buyer",
    userEmail: null,
    buyerLegalEntityDisplayName: null,
    phoneDisplay: null,
    phoneE164: "+447700900123",
    lotIds: ["lot-1"],
    authorizedMax: "5000.00",
    status: "confirmed",
    clerkUserId: null,
    notes: null,
    buyerNotes: null,
    approvedByUserId: null,
    completedLotIds: [],
    limitIncreaseRequestedAt: null,
    limitIncreaseAmount: null,
    cancelledAt: null,
    cancelledByUserId: null,
    cancellationReason: null,
    createdAt: new Date("2026-06-17T09:00:00.000Z"),
    confirmedAt: null,
    updatedAt: new Date("2026-06-17T09:00:00.000Z"),
  },
];

const baseOptions = {
  saleId: "sale-1",
  currentLotId: "lot-1",
  liveCurrentPrice: "100.00",
  minBidIncrement: "10.00",
  telephoneBookings: [],
  paddleRoster: baseRoster,
};

describe("useClerkBidEntry", () => {
  it("persists paddle number in sessionStorage", () => {
    sessionStorage.clear();
    const { result } = renderHook(() => useClerkBidEntry(baseOptions));

    act(() => {
      result.current.setPaddleNumber("142");
    });

    expect(sessionStorage.getItem("saleroom-clerk-paddle:sale-1")).toBe("142");
    expect(result.current.state.paddleNumber).toBe("142");
  });

  it("clears bid amounts when currentLotId changes", () => {
    const { result, rerender } = renderHook(
      ({ currentLotId }) =>
        useClerkBidEntry({
          ...baseOptions,
          currentLotId,
        }),
      { initialProps: { currentLotId: "lot-1" } },
    );

    act(() => {
      result.current.setPaddleNumber("142");
      result.current.setPaddleAmount("500");
      result.current.setTelephoneAmount("600");
      result.current.setBookingId("booking-1");
    });

    expect(result.current.state.paddleNumber).toBe("142");
    expect(result.current.state.paddleAmount).toBe("500");
    expect(result.current.state.telephoneAmount).toBe("600");
    expect(result.current.state.bookingId).toBe("booking-1");

    rerender({ currentLotId: "lot-2" });

    expect(result.current.state.paddleNumber).toBe("142");
    expect(result.current.state.paddleAmount).toBe("");
    expect(result.current.state.telephoneAmount).toBe("");
    expect(result.current.state.bookingId).toBe("");
  });

  it("uses injected paddle bid action", async () => {
    const placePaddleBid = vi.fn().mockResolvedValue({ ok: true as const });

    const { result } = renderHook(() =>
      useClerkBidEntry({
        ...baseOptions,
        placePaddleBid,
      }),
    );

    act(() => {
      result.current.setPaddleNumber("142");
      result.current.setPaddleAmount("150");
    });

    await act(async () => {
      result.current.placePaddleBid();
      await Promise.resolve();
    });

    expect(placePaddleBid).toHaveBeenCalledWith({
      saleId: "sale-1",
      lotId: "lot-1",
      paddleNumber: 142,
      amount: 150,
    });
  });

  it("blocks paddle bids for unchecked-in paddle numbers", async () => {
    const placePaddleBid = vi.fn().mockResolvedValue({ ok: true as const });

    const { result } = renderHook(() =>
      useClerkBidEntry({
        ...baseOptions,
        placePaddleBid,
      }),
    );

    act(() => {
      result.current.setPaddleNumber("999");
      result.current.setPaddleAmount("150");
    });

    await act(async () => {
      result.current.placePaddleBid();
      await Promise.resolve();
    });

    expect(placePaddleBid).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalledWith("Paddle not checked in for this sale");
    expect(result.current.canPlacePaddleBid).toBe(false);
  });

  it("requires booking and amount before telephone bid is enabled", () => {
    const { result } = renderHook(() =>
      useClerkBidEntry({
        ...baseOptions,
        telephoneBookings,
      }),
    );

    expect(result.current.canPlaceTelephoneBid).toBe(false);

    act(() => {
      result.current.setBookingId("booking-1");
      result.current.setTelephoneAmount("150");
    });

    expect(result.current.canPlaceTelephoneBid).toBe(true);
  });

  describe("a bid a limit refused", () => {
    const refusal = { kind: "paddle" as const, limit: "5000.00", available: null };

    async function refusedPaddleBid() {
      vi.mocked(notify.error).mockClear();
      const placePaddleBid = vi
        .fn()
        .mockResolvedValue({ ok: false as const, error: "Bid exceeds authorized limit", refusal });
      const hook = renderHook(
        ({ currentLotId }) => useClerkBidEntry({ ...baseOptions, currentLotId, placePaddleBid }),
        { initialProps: { currentLotId: "lot-1" } },
      );
      act(() => {
        hook.result.current.setPaddleNumber("142");
        hook.result.current.setPaddleAmount("6000");
      });
      await act(async () => {
        hook.result.current.placePaddleBid();
        await Promise.resolve();
      });
      return hook;
    }

    it("keeps the limit by the paddle form instead of an error toast", async () => {
      const { result } = await refusedPaddleBid();

      expect(result.current.limitRefusal).toEqual({
        channel: "paddle",
        refusal,
        bidder: "Paddle 142",
        amount: 6000,
      });
      expect(notify.error).not.toHaveBeenCalled();
      expect(result.current.state.paddleAmount).toBe("6000");
    });

    it("clears it when the clerk changes the bid or the lot moves on", async () => {
      const first = await refusedPaddleBid();
      act(() => {
        first.result.current.setTelephoneAmount("100");
      });
      expect(first.result.current.limitRefusal?.channel).toBe("paddle");
      act(() => {
        first.result.current.setPaddleAmount("4000");
      });
      expect(first.result.current.limitRefusal).toBeNull();

      const second = await refusedPaddleBid();
      second.rerender({ currentLotId: "lot-2" });
      expect(second.result.current.limitRefusal).toBeNull();
    });

    it("clears it when the clerk picks another paddle or a quick amount", async () => {
      const first = await refusedPaddleBid();
      act(() => {
        first.result.current.setPaddleNumber("143");
      });
      expect(first.result.current.limitRefusal).toBeNull();

      const second = await refusedPaddleBid();
      act(() => {
        second.result.current.applyIncrement(110, "telephone");
      });
      expect(second.result.current.limitRefusal?.channel).toBe("paddle");
      act(() => {
        second.result.current.applyIncrement(110, "paddle");
      });
      expect(second.result.current.limitRefusal).toBeNull();
    });

    it("clears it while the next bid is placed, so a repeat refusal is a fresh alert", async () => {
      let answer: (value: unknown) => void = () => undefined;
      const placePaddleBid = vi
        .fn()
        .mockResolvedValueOnce({ ok: false as const, error: "Over", refusal })
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              answer = resolve;
            }),
        );
      const { result } = renderHook(() => useClerkBidEntry({ ...baseOptions, placePaddleBid }));
      act(() => {
        result.current.setPaddleNumber("142");
        result.current.setPaddleAmount("6000");
      });
      await act(async () => {
        result.current.placePaddleBid();
        await Promise.resolve();
      });
      const firstRefusal = result.current.limitRefusal;
      expect(firstRefusal?.channel).toBe("paddle");

      await act(async () => {
        result.current.placePaddleBid();
        await Promise.resolve();
      });
      expect(placePaddleBid).toHaveBeenCalledTimes(2);
      expect(result.current.limitRefusal).toBeNull();

      await act(async () => {
        answer({ ok: false, error: "Over", refusal });
        await Promise.resolve();
      });
      expect(result.current.limitRefusal).toEqual(firstRefusal);
      expect(result.current.limitRefusal).not.toBe(firstRefusal);
    });

    it("is gone after a later bid is placed", async () => {
      const placePaddleBid = vi
        .fn()
        .mockResolvedValueOnce({ ok: false as const, error: "Over", refusal })
        .mockResolvedValueOnce({ ok: true as const });
      const { result } = renderHook(() => useClerkBidEntry({ ...baseOptions, placePaddleBid }));
      act(() => {
        result.current.setPaddleNumber("142");
        result.current.setPaddleAmount("6000");
      });
      await act(async () => {
        result.current.placePaddleBid();
        await Promise.resolve();
      });
      expect(result.current.limitRefusal).not.toBeNull();
      await act(async () => {
        result.current.placePaddleBid();
        await Promise.resolve();
      });
      expect(result.current.limitRefusal).toBeNull();
      expect(notify.success).toHaveBeenCalledWith("Paddle 142 bid placed");
    });
  });

  describe("a telephone bid a limit refused", () => {
    const refusal = { kind: "telephone" as const, limit: "5000.00", available: null };

    async function refusedTelephoneBid() {
      vi.mocked(notify.error).mockClear();
      const placeTelephoneBid = vi
        .fn()
        .mockResolvedValue({ ok: false as const, error: "Over the maximum", refusal });
      const hook = renderHook(() =>
        useClerkBidEntry({ ...baseOptions, telephoneBookings, placeTelephoneBid }),
      );
      act(() => {
        hook.result.current.setBookingId("booking-1");
        hook.result.current.setTelephoneAmount("6000");
      });
      await act(async () => {
        hook.result.current.placeTelephoneBid();
        await Promise.resolve();
      });
      return hook;
    }

    it("keeps it by the telephone form, under the booking's bidder, without a toast", async () => {
      const { result } = await refusedTelephoneBid();

      expect(result.current.limitRefusal).toEqual({
        channel: "telephone",
        refusal,
        bidder: "Tel buyer",
        amount: 6000,
      });
      expect(notify.error).not.toHaveBeenCalled();
    });

    it("clears it when the clerk changes the telephone line, but not for a paddle edit", async () => {
      const { result } = await refusedTelephoneBid();
      act(() => {
        result.current.setPaddleAmount("100");
      });
      expect(result.current.limitRefusal?.channel).toBe("telephone");
      act(() => {
        result.current.setBookingId("booking-2");
      });
      expect(result.current.limitRefusal).toBeNull();
    });

    it("clears it while the next telephone bid is placed", async () => {
      let answer: (value: unknown) => void = () => undefined;
      const placeTelephoneBid = vi
        .fn()
        .mockResolvedValueOnce({ ok: false as const, error: "Over the maximum", refusal })
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              answer = resolve;
            }),
        );
      const { result } = renderHook(() =>
        useClerkBidEntry({ ...baseOptions, telephoneBookings, placeTelephoneBid }),
      );
      act(() => {
        result.current.setBookingId("booking-1");
        result.current.setTelephoneAmount("6000");
      });
      await act(async () => {
        result.current.placeTelephoneBid();
        await Promise.resolve();
      });
      expect(result.current.limitRefusal?.channel).toBe("telephone");
      await act(async () => {
        result.current.placeTelephoneBid();
        await Promise.resolve();
      });
      expect(result.current.limitRefusal).toBeNull();
      await act(async () => {
        answer({ ok: true });
        await Promise.resolve();
      });
      expect(result.current.limitRefusal).toBeNull();
    });

    it("clears it when the clerk picks a quick amount for the telephone bid", async () => {
      const { result } = await refusedTelephoneBid();
      act(() => {
        result.current.applyIncrement(110, "telephone");
      });
      expect(result.current.limitRefusal).toBeNull();
    });
  });
});
