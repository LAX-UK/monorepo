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
});
