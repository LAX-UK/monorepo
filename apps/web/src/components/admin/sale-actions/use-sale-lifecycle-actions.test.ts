import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSaleLifecycleActions } from "./use-sale-lifecycle-actions";

const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, replace, push: vi.fn() }),
  usePathname: () => "/admin/sales/s1",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/actions/admin-sales", () => ({
  adminPublishSaleResultAction: vi.fn(),
  adminCancelSaleResultAction: vi.fn(),
  adminMarkSaleEndedResultAction: vi.fn(),
  adminSoftDeleteSaleResultAction: vi.fn(),
  adminUnpublishSaleResultAction: vi.fn(),
}));

vi.mock("@/lib/ui/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}));

import { adminPublishSaleResultAction } from "@/lib/actions/admin-sales";
import { notify } from "@/lib/ui/notify";

describe("useSaleLifecycleActions", () => {
  it("promotes connect_required publish failures to shell URL instead of toast", async () => {
    vi.mocked(adminPublishSaleResultAction).mockResolvedValue({
      ok: false,
      error: "Connect not ready",
      errorCode: "connect_required",
      status: 409,
    });

    const { result } = renderHook(() => useSaleLifecycleActions("s1"));
    result.current.publish();

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith(
        expect.stringContaining("error_code=connect_required"),
        expect.objectContaining({ scroll: false }),
      );
    });
    expect(notify.error).not.toHaveBeenCalled();
  });
});
