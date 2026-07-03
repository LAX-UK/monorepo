import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/observability/instrument-server-action", () => ({
  instrumentServerAction: (_name: string, fn: () => Promise<unknown>) => fn(),
}));

const denyUnlessAdminCapability = vi.fn();
vi.mock("@/lib/auth/assert-admin-action-capability", () => ({
  denyUnlessAdminCapability: (...args: unknown[]) => denyUnlessAdminCapability(...args),
}));

const list = vi.fn();
const create = vi.fn();
const regenerate = vi.fn();
const getAnalytics = vi.fn();
vi.mock("@/lib/data/write-container.server", () => ({
  getWriteContainer: () => ({
    adminQrCodes: { list, create, regenerate, getAnalytics },
  }),
}));

import {
  adminEnsureLotQrCodesForPrintResultAction,
  adminLoadQrCodeAnalyticsResultAction,
  adminLoadQrCodeDialogResultAction,
  adminRegenerateQrCodeResultAction,
} from "@/lib/actions/admin-qr-codes";

const uuid = "11111111-1111-4111-8111-111111111111";
const analyticsPayload = {
  source: "daily" as const,
  granularity: "day" as const,
  rangeKey: "30d",
  totalScans: 3,
  uniqueIps: null,
  trend: [],
  byDevice: [],
  byCountry: [],
  byBrowser: null,
  byOs: null,
  byReferrer: null,
  recentScans: null,
};
const qrItem = {
  id: "22222222-2222-4222-8222-222222222222",
  shortCode: "Abc12345",
  shortUrl: "https://web.example.test/q/Abc12345",
  destinationUrl: "https://web.example.test/lot/test",
  status: "active" as const,
  campaign: null,
  placement: "admin",
};

describe("admin QR code actions", () => {
  beforeEach(() => {
    denyUnlessAdminCapability.mockReset();
    list.mockReset();
    create.mockReset();
    regenerate.mockReset();
    getAnalytics.mockReset();
    denyUnlessAdminCapability.mockResolvedValue(null);
  });

  it("loads or creates the default QR code and fetches analytics", async () => {
    list.mockResolvedValueOnce({ ok: true, data: [], status: 200 });
    create.mockResolvedValueOnce({ ok: true, data: qrItem, status: 201 });
    getAnalytics.mockResolvedValueOnce({ ok: true, data: analyticsPayload, status: 200 });

    const result = await adminLoadQrCodeDialogResultAction("lot", uuid);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.item.shortUrl).toBe(qrItem.shortUrl);
      expect(result.data?.analytics?.totalScans).toBe(3);
    }
    expect(create).toHaveBeenCalledWith({
      entityType: "lot",
      entityId: uuid,
      placement: "admin",
    });
  });

  it("returns capability denial before calling the API", async () => {
    denyUnlessAdminCapability.mockResolvedValue({
      ok: false,
      error: "You do not have permission to perform this action",
      status: 403,
    });

    const result = await adminLoadQrCodeDialogResultAction("lot", uuid);

    expect(result.ok).toBe(false);
    expect(list).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("ensures lot QR codes for printing", async () => {
    create.mockResolvedValue({ ok: true, data: qrItem, status: 201 });

    const result = await adminEnsureLotQrCodesForPrintResultAction([
      { id: uuid, title: "Lot title", lotNumber: 7 },
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.[0]?.shortUrl).toBe(qrItem.shortUrl);
    }
    expect(create).toHaveBeenCalledWith({
      entityType: "lot",
      entityId: uuid,
      placement: "gallery-label",
    });
  });

  it("loads analytics for a selected range", async () => {
    getAnalytics.mockResolvedValue({ ok: true, data: analyticsPayload, status: 200 });

    const result = await adminLoadQrCodeAnalyticsResultAction(qrItem.id, { range: "24h" });

    expect(result.ok).toBe(true);
    expect(getAnalytics).toHaveBeenCalledWith(qrItem.id, { range: "24h" });
  });

  it("regenerates a QR code through the admin API", async () => {
    regenerate.mockResolvedValue({ ok: true, data: qrItem, status: 201 });

    const result = await adminRegenerateQrCodeResultAction("lot", uuid);

    expect(result.ok).toBe(true);
    expect(regenerate).toHaveBeenCalledWith({ entityType: "lot", entityId: uuid });
  });
});
