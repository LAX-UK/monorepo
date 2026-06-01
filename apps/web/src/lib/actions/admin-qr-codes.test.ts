import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/observability/instrument-server-action", () => ({
  instrumentServerAction: (_name: string, fn: () => Promise<unknown>) => fn(),
}));

const denyUnlessAdminCapability = vi.fn();
vi.mock("@/lib/auth/assert-admin-action-capability", () => ({
  denyUnlessAdminCapability: (...args: unknown[]) => denyUnlessAdminCapability(...args),
}));

const authedServerFetch = vi.fn();
vi.mock("@/lib/data/http/authed-server-fetch", () => ({
  authedServerFetch: (...args: unknown[]) => authedServerFetch(...args),
}));

import {
  adminEnsureLotQrCodesForPrintResultAction,
  adminLoadQrCodeDialogResultAction,
  adminRegenerateQrCodeResultAction,
} from "@/lib/actions/admin-qr-codes";

const uuid = "11111111-1111-4111-8111-111111111111";
const qrItem = {
  id: "22222222-2222-4222-8222-222222222222",
  shortCode: "Abc12345",
  shortUrl: "https://web.example.test/q/Abc12345",
  destinationUrl: "https://web.example.test/lot/test",
  status: "active" as const,
  campaign: null,
  placement: "admin",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("admin QR code actions", () => {
  beforeEach(() => {
    denyUnlessAdminCapability.mockReset();
    authedServerFetch.mockReset();
    denyUnlessAdminCapability.mockResolvedValue(null);
  });

  it("loads or creates the default QR code and fetches analytics", async () => {
    authedServerFetch
      .mockResolvedValueOnce(jsonResponse({ data: { items: [] } }))
      .mockResolvedValueOnce(jsonResponse({ data: qrItem }, 201))
      .mockResolvedValueOnce(
        jsonResponse({ data: { totalScans: 3, daily: [], byCountry: [], byDevice: [] } }),
      );

    const result = await adminLoadQrCodeDialogResultAction("lot", uuid);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.item.shortUrl).toBe(qrItem.shortUrl);
      expect(result.data?.analytics?.totalScans).toBe(3);
    }
    expect(authedServerFetch).toHaveBeenNthCalledWith(
      2,
      "/admin/qr-codes",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ entityType: "lot", entityId: uuid, placement: "admin" }),
        skipActingLegalEntityHeader: true,
      }),
    );
  });

  it("returns capability denial before calling the API", async () => {
    denyUnlessAdminCapability.mockResolvedValue({
      ok: false,
      error: "You do not have permission to perform this action",
      status: 403,
    });

    const result = await adminLoadQrCodeDialogResultAction("lot", uuid);

    expect(result.ok).toBe(false);
    expect(authedServerFetch).not.toHaveBeenCalled();
  });

  it("ensures lot QR codes for printing", async () => {
    authedServerFetch.mockResolvedValue(jsonResponse({ data: qrItem }, 201));

    const result = await adminEnsureLotQrCodesForPrintResultAction([
      { id: uuid, title: "Lot title", lotNumber: 7 },
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.[0]?.shortUrl).toBe(qrItem.shortUrl);
    }
    expect(authedServerFetch).toHaveBeenCalledWith(
      "/admin/qr-codes",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ entityType: "lot", entityId: uuid, placement: "gallery-label" }),
      }),
    );
  });

  it("regenerates a QR code through the admin API", async () => {
    authedServerFetch.mockResolvedValue(jsonResponse({ data: qrItem }, 201));

    const result = await adminRegenerateQrCodeResultAction("lot", uuid);

    expect(result.ok).toBe(true);
    expect(authedServerFetch).toHaveBeenCalledWith(
      "/admin/qr-codes/regenerate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ entityType: "lot", entityId: uuid }),
      }),
    );
  });
});
