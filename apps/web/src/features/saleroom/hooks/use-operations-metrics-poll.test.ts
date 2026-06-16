import { useOperationsMetricsPoll } from "@/features/saleroom/hooks/use-operations-metrics-poll";
import type { AdminPaddleRosterEntry } from "@/lib/data/http/admin.server";
import type { AdminSaleOperationsSnapshot } from "@/lib/telephone/telephone-booking-types";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchAdminSaleOperationsSnapshot = vi.fn();
const fetchAdminSalePaddleRoster = vi.fn();

vi.mock("@/lib/data/http/operations-snapshot.client", () => ({
  fetchAdminSaleOperationsSnapshot: (...args: unknown[]) =>
    fetchAdminSaleOperationsSnapshot(...args),
  fetchAdminSalePaddleRoster: (...args: unknown[]) => fetchAdminSalePaddleRoster(...args),
}));

const saleId = "sale-1";

const initialSnapshot: AdminSaleOperationsSnapshot = {
  sale: {
    id: saleId,
    title: "Hybrid sale",
    status: "active",
    deliveryMode: "hybrid",
    startTime: null,
    venueName: null,
    streamUrl: null,
  },
  saleroomSession: {
    status: "live",
    currentLotId: "lot-1",
    currentLotNumber: 1,
    currentLotTitle: "Lot 1",
  },
  currentLotBidding: null,
  registrations: { pending: 2, approved: 5, rejected: 0 },
  telephoneBookings: { requested: 1, confirmed: 0, inProgress: 0, completed: 0 },
  pendingActions: { registrations: [], telephone: [] },
};

const initialRoster: AdminPaddleRosterEntry[] = [
  {
    paddleNumber: 101,
    userId: "user-1",
    displayName: "Jane Doe",
    bidLimit: null,
    hasActiveSelfServiceSession: false,
  },
];

describe("useOperationsMetricsPoll", () => {
  beforeEach(() => {
    fetchAdminSaleOperationsSnapshot.mockReset();
    fetchAdminSalePaddleRoster.mockReset();
    fetchAdminSaleOperationsSnapshot.mockResolvedValue({
      ...initialSnapshot,
      registrations: { pending: 0, approved: 6, rejected: 0 },
    });
    fetchAdminSalePaddleRoster.mockResolvedValue([
      ...initialRoster,
      {
        paddleNumber: 102,
        userId: "user-2",
        displayName: "John Smith",
        bidLimit: null,
        hasActiveSelfServiceSession: false,
      },
    ]);
  });

  it("refreshes snapshot and roster on mount", async () => {
    const { result } = renderHook(() =>
      useOperationsMetricsPoll({
        saleId,
        initialSnapshot,
        initialPaddleRoster: initialRoster,
      }),
    );

    await waitFor(() => {
      expect(fetchAdminSaleOperationsSnapshot).toHaveBeenCalledWith(saleId);
      expect(fetchAdminSalePaddleRoster).toHaveBeenCalledWith(saleId);
    });

    await waitFor(() => {
      expect(result.current.snapshot.registrations.pending).toBe(0);
      expect(result.current.paddleRoster).toHaveLength(2);
    });
  });

  it("ignores stale refresh responses", async () => {
    let resolveSlow: ((value: AdminSaleOperationsSnapshot) => void) | undefined;
    const slowPromise = new Promise<AdminSaleOperationsSnapshot>((resolve) => {
      resolveSlow = resolve;
    });

    fetchAdminSaleOperationsSnapshot
      .mockImplementationOnce(() => slowPromise)
      .mockResolvedValueOnce({
        ...initialSnapshot,
        registrations: { pending: 9, approved: 1, rejected: 0 },
      });

    const { result, rerender } = renderHook(
      (props: { saleId: string }) =>
        useOperationsMetricsPoll({
          saleId: props.saleId,
          initialSnapshot,
          initialPaddleRoster: initialRoster,
        }),
      { initialProps: { saleId: "sale-a" } },
    );

    rerender({ saleId: "sale-b" });

    await act(async () => {
      resolveSlow?.({
        ...initialSnapshot,
        registrations: { pending: 99, approved: 0, rejected: 0 },
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.snapshot.registrations.pending).not.toBe(99);
    });
  });
});
