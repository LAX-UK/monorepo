import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordQrCodeScanJob } from "./qr-code-scan.js";

const { persistQrCodeScan } = vi.hoisted(() => ({
  persistQrCodeScan: vi.fn(),
}));

vi.mock("@auction/api/exports", () => ({
  persistQrCodeScan,
}));

describe("recordQrCodeScanJob", () => {
  beforeEach(() => {
    persistQrCodeScan.mockReset();
  });

  it("persists QR scan payloads", async () => {
    await recordQrCodeScanJob({
      db: {} as never,
      data: { qrCodeId: " qr_1 ", requestId: "req_1" },
      log: { debug: vi.fn() } as never,
    });

    expect(persistQrCodeScan).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ qrCodeId: "qr_1", requestId: "req_1" }),
    );
  });

  it("rejects jobs without a QR code id", async () => {
    await expect(
      recordQrCodeScanJob({
        db: {} as never,
        data: { qrCodeId: "" },
        log: { debug: vi.fn() } as never,
      }),
    ).rejects.toThrow("qr-code-scan job is missing qrCodeId");
  });
});
