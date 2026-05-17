import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLotImagesSave } from "./use-lot-images-save";

const adminUpdateLotResultAction = vi.fn();
const adminUpdateLotMarketingDetailsResultAction = vi.fn();

vi.mock("@/lib/actions/admin", () => ({
  adminUpdateLotResultAction: (...args: unknown[]) => adminUpdateLotResultAction(...args),
  adminUpdateLotMarketingDetailsResultAction: (...args: unknown[]) =>
    adminUpdateLotMarketingDetailsResultAction(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/lib/ui/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

describe("useLotImagesSave", () => {
  beforeEach(() => {
    adminUpdateLotResultAction.mockReset();
    adminUpdateLotMarketingDetailsResultAction.mockReset();
  });

  it("sends imageAlts even when all alts are empty", async () => {
    adminUpdateLotResultAction.mockResolvedValue({ ok: true });
    adminUpdateLotMarketingDetailsResultAction.mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useLotImagesSave("lot-1"));

    act(() => {
      result.current.save([{ key: "k1", alt: "" }]);
    });

    await waitFor(() => {
      expect(adminUpdateLotMarketingDetailsResultAction).toHaveBeenCalledWith("lot-1", {
        imageAlts: [""],
      });
    });
  });

  it("marks partial success when alt patch fails after images save", async () => {
    adminUpdateLotResultAction.mockResolvedValue({ ok: true });
    adminUpdateLotMarketingDetailsResultAction.mockResolvedValue({
      ok: false,
      error: "nope",
    });
    const { result } = renderHook(() => useLotImagesSave("lot-1"));

    act(() => {
      result.current.save([{ key: "k1", alt: "alt" }]);
    });

    await waitFor(() => {
      expect(result.current.lastResult).toBe("partial");
    });
  });
});
