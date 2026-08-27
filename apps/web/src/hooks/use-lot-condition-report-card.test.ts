import { useLotConditionReportCard } from "@/hooks/use-lot-condition-report-card";
import type { ConditionReportRequestPort } from "@/lib/condition-report/condition-report-request.port";
import type { LotConditionReportSessionInput } from "@/lib/condition-report/lot-condition-report-session-input";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const submitMock = vi.fn();
const setDismissedMock = vi.fn();

vi.mock("@/hooks/use-condition-report-request", () => ({
  useConditionReportRequest: () => ({
    uiPhase: "idle" as const,
    submitErrorMessage: null,
    submit: submitMock,
  }),
}));

vi.mock("@/lib/condition-report/condition-report-dismiss", () => ({
  isConditionReportDismissed: vi.fn(() => false),
  setConditionReportDismissed: (...args: unknown[]) => setDismissedMock(...args),
}));

const baseInput: LotConditionReportSessionInput = {
  lotId: "lot-1",
  loginNextPath: "/lot/x/lot-1",
  show: true,
  canParticipate: true,
  session: {
    isAuthenticated: true,
    emailVerified: true,
    email: "buyer@example.com",
    kycStatus: "approved",
    kycFeedback: null,
    userId: "user-1",
  },
  published: null,
  buyerRequest: null,
};

describe("useLotConditionReportCard", () => {
  beforeEach(() => {
    submitMock.mockReset();
    setDismissedMock.mockReset();
  });

  it("derives canRequest card state for an eligible session", () => {
    const { result } = renderHook(() => useLotConditionReportCard(baseInput));
    expect(result.current.cardState).toEqual({ kind: "canRequest" });
    expect(result.current.isDismissed).toBe(false);
  });

  it("records dismiss and exposes restore handlers", () => {
    const { result } = renderHook(() => useLotConditionReportCard(baseInput));

    act(() => {
      result.current.onHide();
    });

    expect(setDismissedMock).toHaveBeenCalledWith("user-1", "lot-1", true);

    act(() => {
      result.current.onRestore();
    });

    expect(setDismissedMock).toHaveBeenCalledWith("user-1", "lot-1", false);
  });

  it("stores optimistic request after successful submit", async () => {
    const row = {
      id: "req-1",
      lotId: "lot-1",
      status: "pending" as const,
      requestNote: "Please inspect frame",
      responseNote: null,
      createdAt: "2026-08-25T12:00:00.000Z",
    };
    submitMock.mockResolvedValue(row);

    const port: ConditionReportRequestPort = {
      getForLot: async () => null,
      submit: vi.fn(),
    };

    const { result } = renderHook(() => useLotConditionReportCard(baseInput, port));

    await act(async () => {
      const ok = await result.current.onSubmitRequest({ requestNote: "Please inspect frame" });
      expect(ok).toBe(true);
    });

    await waitFor(() => {
      expect(result.current.cardState).toBeNull();
    });
    expect(submitMock).toHaveBeenCalledWith("Please inspect frame");
  });
});
