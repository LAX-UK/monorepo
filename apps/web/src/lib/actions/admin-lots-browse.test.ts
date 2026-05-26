import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/observability/instrument-server-action", () => ({
  instrumentServerAction: (_name: string, fn: () => Promise<unknown>) => fn(),
}));

const denyUnlessAdminCapability = vi.fn();
vi.mock("@/lib/auth/assert-admin-action-capability", () => ({
  denyUnlessAdminCapability: (...args: unknown[]) => denyUnlessAdminCapability(...args),
}));

const getAdminLotBrowse = vi.fn();
const getAdminLotBrowseFallback = vi.fn();
vi.mock("@/lib/data/http/admin.server", () => ({
  AdminLotBrowseError: class AdminLotBrowseError extends Error {
    readonly status: number;
    constructor(status: number) {
      super(`Failed to browse lots: ${status}`);
      this.status = status;
    }
  },
  getAdminLotBrowse: (...args: unknown[]) => getAdminLotBrowse(...args),
}));
vi.mock("@/lib/admin/lot-browse-fallback", () => ({
  getAdminLotBrowseFallback: (...args: unknown[]) => getAdminLotBrowseFallback(...args),
}));

import { searchAdminLotsBrowseAction } from "@/lib/actions/admin-lots-browse";
import { AdminLotBrowseError } from "@/lib/data/http/admin.server";

describe("searchAdminLotsBrowseAction", () => {
  beforeEach(() => {
    denyUnlessAdminCapability.mockReset();
    getAdminLotBrowse.mockReset();
    getAdminLotBrowseFallback.mockReset();
    denyUnlessAdminCapability.mockResolvedValue(null);
  });

  it("returns rows and total on success", async () => {
    getAdminLotBrowse.mockResolvedValue({
      rows: [
        {
          id: "lot-1",
          title: "Blue vase",
          lifecycle: {
            kind: "new_draft",
            returnedAt: null,
            lastSaleId: null,
            lastSaleName: null,
            returnCount: 0,
          },
        },
      ],
      total: 1,
    });

    const result = await searchAdminLotsBrowseAction({ q: "vase", state: "all" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.rows).toHaveLength(1);
      expect(result.data?.total).toBe(1);
    }
    expect(getAdminLotBrowse).toHaveBeenCalledWith({
      q: "vase",
      state: "all",
      limit: 25,
      offset: 0,
    });
    expect(getAdminLotBrowseFallback).not.toHaveBeenCalled();
  });

  it("returns capability denial without calling browse", async () => {
    denyUnlessAdminCapability.mockResolvedValue({
      ok: false,
      error: "You do not have permission to perform this action",
      status: 403,
    });

    const result = await searchAdminLotsBrowseAction({ state: "available" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
    }
    expect(getAdminLotBrowse).not.toHaveBeenCalled();
  });

  it("falls back to getAdminLotList path when browse returns 404", async () => {
    getAdminLotBrowse.mockRejectedValue(new AdminLotBrowseError(404));
    getAdminLotBrowseFallback.mockResolvedValue({
      rows: [
        {
          id: "lot-fallback",
          title: "Fallback lot",
          lifecycle: {
            kind: "new_draft",
            returnedAt: null,
            lastSaleId: null,
            lastSaleName: null,
            returnCount: 0,
          },
        },
      ],
      total: 1,
    });

    const result = await searchAdminLotsBrowseAction({ q: "fallback", state: "available" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.rows[0]?.id).toBe("lot-fallback");
      expect(result.data?.total).toBe(1);
    }
    expect(getAdminLotBrowseFallback).toHaveBeenCalledWith({
      q: "fallback",
      state: "available",
      limit: 25,
      offset: 0,
    });
  });

  it("surfaces non-404 API errors from getAdminLotBrowse", async () => {
    getAdminLotBrowse.mockRejectedValue(new AdminLotBrowseError(500));

    const result = await searchAdminLotsBrowseAction({ state: "all" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Failed to browse lots: 500");
    }
    expect(getAdminLotBrowseFallback).not.toHaveBeenCalled();
  });
});
