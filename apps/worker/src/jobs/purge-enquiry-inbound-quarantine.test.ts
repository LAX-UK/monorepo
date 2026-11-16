import { describe, expect, it, vi } from "vitest";
import { purgeEnquiryInboundQuarantine } from "./purge-enquiry-inbound-quarantine.js";

const NOW = new Date("2026-11-15T03:40:00.000Z");

describe("purgeEnquiryInboundQuarantine", () => {
  it("deletes due rows in batches until a short batch, against one fixed clock", async () => {
    const purgeDue = vi
      .fn()
      .mockResolvedValueOnce({ deleted: 2, batchCount: 2 })
      .mockResolvedValueOnce({ deleted: 1, batchCount: 1 });
    const log = { info: vi.fn() };

    const result = await purgeEnquiryInboundQuarantine({
      repository: { purgeDue },
      log,
      batchSize: 2,
      now: NOW,
    });

    expect(result).toEqual({ deleted: 3, batches: 2 });
    expect(purgeDue).toHaveBeenCalledTimes(2);
    expect(purgeDue).toHaveBeenNthCalledWith(1, NOW, 2);
    expect(purgeDue).toHaveBeenNthCalledWith(2, NOW, 2);
  });

  it("is idempotent: with nothing due it deletes nothing and still reports the run", async () => {
    const purgeDue = vi.fn().mockResolvedValue({ deleted: 0, batchCount: 0 });
    const log = { info: vi.fn() };

    const result = await purgeEnquiryInboundQuarantine({ repository: { purgeDue }, log, now: NOW });

    expect(result).toEqual({ deleted: 0, batches: 0 });
    expect(purgeDue).toHaveBeenCalledTimes(1);
    expect(log.info).toHaveBeenCalledWith(
      { deleted: 0, batches: 0 },
      "purge-enquiry-inbound-quarantine: done",
    );
  });

  it("counts a row a concurrent run already deleted as picked but not deleted", async () => {
    const purgeDue = vi.fn().mockResolvedValueOnce({ deleted: 1, batchCount: 2 });
    purgeDue.mockResolvedValueOnce({ deleted: 0, batchCount: 0 });

    const result = await purgeEnquiryInboundQuarantine({
      repository: { purgeDue },
      log: { info: vi.fn() },
      batchSize: 2,
      now: NOW,
    });

    expect(result.deleted).toBe(1);
  });

  it("logs counts only", async () => {
    const purgeDue = vi.fn().mockResolvedValueOnce({ deleted: 4, batchCount: 4 });
    const log = { info: vi.fn() };

    await purgeEnquiryInboundQuarantine({ repository: { purgeDue }, log, batchSize: 10, now: NOW });

    const [fields] = log.info.mock.calls[0] ?? [];
    expect(Object.keys(fields as object).sort()).toEqual(["batches", "deleted"]);
  });
});
