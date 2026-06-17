import { useClerkBidEntry } from "@/features/saleroom/hooks/use-clerk-bid-entry";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ui/notify", () => ({
  notify: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const baseOptions = {
  saleId: "sale-1",
  currentLotId: "lot-1",
  liveCurrentPrice: "100.00",
  minBidIncrement: "10.00",
  telephoneBookings: [],
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
});
