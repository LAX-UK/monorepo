import type { RegisterLotMismatch } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { checkRegisterLotIntegrity } from "./register-lot-integrity-check.js";

const mismatch = (stockCode: string): RegisterLotMismatch => ({
  registerId: `reg-${stockCode}`,
  stockCode,
  title: "Harbour at dusk",
  lotId: "lot-1",
  lotStatus: "draft",
  changedAt: new Date("2026-11-03T09:00:00.000Z"),
});

function setup(rows: RegisterLotMismatch[]) {
  const log = { warn: vi.fn(), info: vi.fn() };
  const reader = { listBidSaleMismatches: vi.fn().mockResolvedValue(rows) };
  return { log, reader, run: () => checkRegisterLotIntegrity({ reader, log: log as never }) };
}

describe("checkRegisterLotIntegrity", () => {
  it("warns with what it found and changes nothing", async () => {
    const { run, log } = setup([mismatch("LAX-1"), mismatch("LAX-2")]);
    await expect(run()).resolves.toEqual({ found: 2 });
    expect(log.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        found: 2,
        sample: [
          expect.objectContaining({ stockCode: "LAX-1", lotStatus: "draft" }),
          expect.objectContaining({ stockCode: "LAX-2" }),
        ],
      }),
      "register_lot_mismatch_found",
    );
  });

  it("is quiet once the register and the lots agree", async () => {
    const { run, log } = setup([]);
    await expect(run()).resolves.toEqual({ found: 0 });
    expect(log.warn).not.toHaveBeenCalled();
    expect(log.info).toHaveBeenCalledWith({ found: 0 }, "register_lot_integrity_clean");
  });

  it("lists only a sample of a long run in the log", async () => {
    const { run, log } = setup(Array.from({ length: 30 }, (_, i) => mismatch(`LAX-${i}`)));
    await run();
    const payload = log.warn.mock.calls[0]?.[0] as { found: number; sample: unknown[] };
    expect(payload.found).toBe(30);
    expect(payload.sample).toHaveLength(20);
  });
});
