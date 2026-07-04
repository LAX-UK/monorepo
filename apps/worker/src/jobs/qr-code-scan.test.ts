import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordQrCodeScanJob } from "./qr-code-scan.js";

describe("recordQrCodeScanJob", () => {
  const persist = vi.fn().mockResolvedValue(undefined);
  const qrCodeScanPersister = { persist };

  beforeEach(() => {
    persist.mockClear();
  });

  it("persists QR scan payloads", async () => {
    await recordQrCodeScanJob({
      qrCodeScanPersister,
      data: { qrCodeId: " qr_1 ", requestId: "req_1" },
      log: { debug: vi.fn() } as never,
    });

    expect(persist).toHaveBeenCalledWith(
      expect.objectContaining({ qrCodeId: "qr_1", requestId: "req_1" }),
    );
  });

  it("rejects jobs without a QR code id", async () => {
    await expect(
      recordQrCodeScanJob({
        qrCodeScanPersister,
        data: { qrCodeId: "" },
        log: { debug: vi.fn() } as never,
      }),
    ).rejects.toThrow("qr-code-scan job is missing qrCodeId");
  });
});
