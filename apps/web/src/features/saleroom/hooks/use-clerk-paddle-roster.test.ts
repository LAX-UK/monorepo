import { useClerkPaddleRoster } from "@/features/saleroom/hooks/use-clerk-paddle-roster";
import type { AdminPaddleRosterEntry } from "@/lib/data/http/admin.server";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchAdminSalePaddleRoster = vi.fn();

vi.mock("@/lib/data/http/operations-snapshot.client", () => ({
  fetchAdminSalePaddleRoster: (...args: unknown[]) => fetchAdminSalePaddleRoster(...args),
}));

const saleId = "sale-1";

const initialRoster: AdminPaddleRosterEntry[] = [
  {
    paddleNumber: 101,
    userId: "user-1",
    displayName: "Jane Doe",
    bidLimit: null,
    hasActiveSelfServiceSession: false,
  },
];

describe("useClerkPaddleRoster", () => {
  beforeEach(() => {
    fetchAdminSalePaddleRoster.mockReset();
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

  it("refreshes roster on mount when polling is enabled", async () => {
    const { result } = renderHook(() =>
      useClerkPaddleRoster({
        saleId,
        initialRoster,
        pollIntervalMs: 45_000,
      }),
    );

    await waitFor(() => {
      expect(fetchAdminSalePaddleRoster).toHaveBeenCalledWith(saleId);
    });

    await waitFor(() => {
      expect(result.current.roster).toHaveLength(2);
    });
  });

  it("ignores stale refresh responses", async () => {
    let resolveSlow: ((value: AdminPaddleRosterEntry[]) => void) | undefined;
    const slowPromise = new Promise<AdminPaddleRosterEntry[]>((resolve) => {
      resolveSlow = resolve;
    });

    fetchAdminSalePaddleRoster
      .mockImplementationOnce(() => slowPromise)
      .mockResolvedValueOnce([
        {
          paddleNumber: 103,
          userId: "user-3",
          displayName: "Late bidder",
          bidLimit: null,
          hasActiveSelfServiceSession: false,
        },
      ]);

    const { result, rerender } = renderHook(
      (props: { saleId: string }) =>
        useClerkPaddleRoster({
          saleId: props.saleId,
          initialRoster,
          pollIntervalMs: 45_000,
        }),
      { initialProps: { saleId: "sale-a" } },
    );

    rerender({ saleId: "sale-b" });

    await act(async () => {
      resolveSlow?.([
        {
          paddleNumber: 999,
          userId: "stale",
          displayName: "Stale",
          bidLimit: null,
          hasActiveSelfServiceSession: false,
        },
      ]);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.roster.some((entry) => entry.paddleNumber === 999)).toBe(false);
    });
  });
});
