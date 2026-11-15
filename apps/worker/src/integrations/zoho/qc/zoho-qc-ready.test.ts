import type { QcReadyOutcome, QcReadyToPackRequest } from "@auction/artwork-register-contracts";
import type { Logger } from "pino";
import { describe, expect, it, vi } from "vitest";
import type { ZohoRecordState } from "../fulfilment/plan-order.js";
import type { OrderModule } from "../fulfilment/zoho-order-modules.js";
import { ZohoQcAttentionError, ZohoQcReady } from "./zoho-qc-ready.js";

const LINE = "7f1c3a52-9d1e-4b7a-8c55-2f0d6b1e9a10";
const REF = `LAX-S-10482/${LINE}`;
const RECORD = "1023341000017963001";

type ZohoRow = { id: string; fields: Record<string, unknown> };

/** Zoho as the processor sees it: read only. There is no write to call, so none can happen. */
function fakeZoho(row: ZohoRow | null) {
  const finds: string[] = [];
  return {
    finds,
    zoho: {
      async find(
        module: OrderModule,
        keyField: string,
        key: string,
        columns: readonly string[],
      ): Promise<ZohoRecordState | null> {
        finds.push(`${module}:${keyField}:${key}`);
        if (!row || row.id !== key) return null;
        return { id: row.id, fields: Object.fromEntries(columns.map((c) => [c, row.fields[c]])) };
      },
    },
  };
}

function build(
  row: ZohoRow | null,
  options: { mode?: "off" | "dry_run" | "live"; outcome?: QcReadyOutcome } = {},
) {
  const { zoho, finds } = fakeZoho(row);
  const markPassed = vi.fn(async (_request: QcReadyToPackRequest) => options.outcome ?? "moved");
  const log = { info: vi.fn() } as unknown as Logger;
  const ready = new ZohoQcReady({
    mode: options.mode ?? "live",
    zoho,
    shop: { markPassed },
    orderRefField: "LAX_Order_Ref",
    log,
  });
  return { ready, markPassed, finds, log };
}

const job = (fields: Record<string, unknown>): ZohoRow => ({
  id: RECORD,
  fields: {
    Status: "QC Passed",
    Modified_Time: "2026-11-15T10:00:00+00:00",
    LAX_Order_Ref: REF,
    ...fields,
  },
});
const notice = { module: "Framing_Jobs", recordId: RECORD } as const;

describe("Zoho quality check to LAX print step", () => {
  it("does nothing, and never reads Zoho, while the mode is off", async () => {
    const { ready, markPassed, finds } = build(job({}), { mode: "off" });
    expect(await ready.process(notice)).toEqual({ status: "off" });
    expect(finds).toEqual([]);
    expect(markPassed).not.toHaveBeenCalled();
  });

  it("moves the print when the record reads QC Passed, for the order and line its reference names", async () => {
    const { ready, markPassed } = build(job({}));
    expect(await ready.process(notice)).toEqual({ status: "moved" });
    expect(markPassed).toHaveBeenCalledExactlyOnceWith({
      orderReference: "LAX-S-10482",
      lineId: LINE,
    });
  });

  it("acts on the record as Zoho holds it now, so a late notice for a passed job cannot undo a later Rework Required", async () => {
    const { ready, markPassed } = build(job({ Status: "Rework Required" }));
    expect(await ready.process(notice)).toEqual({
      status: "not_passed",
      zohoStatus: "Rework Required",
    });
    expect(markPassed).not.toHaveBeenCalled();
  });

  it("retries when Zoho answers with a version older than the notice instead of acting on it", async () => {
    const { ready, markPassed } = build(job({ Modified_Time: "2026-11-15T10:00:00+00:00" }));
    await expect(
      ready.process({ ...notice, modifiedTime: "2026-11-15T10:05:00.000Z" }),
    ).rejects.toThrow("zoho_qc_record_older_than_notice");
    expect(markPassed).not.toHaveBeenCalled();
  });

  it("treats a repeat as already done", async () => {
    const { ready } = build(job({}), { outcome: "already" });
    expect(await ready.process(notice)).toEqual({ status: "already" });
  });

  it("sends a record Zoho no longer has, or with no usable order reference, to staff and never guesses", async () => {
    for (const row of [
      null,
      job({ LAX_Order_Ref: null }),
      job({ LAX_Order_Ref: "LAX-S-10482" }),
      job({ LAX_Order_Ref: "LAX-S-10482/not-a-line" }),
    ]) {
      const { ready, markPassed } = build(row);
      await expect(ready.process(notice)).rejects.toBeInstanceOf(ZohoQcAttentionError);
      expect(markPassed).not.toHaveBeenCalled();
    }
  });

  it.each(["unmatched", "not_ready", "frame_open"] as const)(
    "sends an order LAX answers %s to staff",
    async (outcome) => {
      const { ready } = build(job({}), { outcome });
      await expect(ready.process(notice)).rejects.toThrow(`zoho_qc_attention:${outcome}`);
    },
  );

  it("in dry_run reads and logs what it would move, and asks LAX Shop for nothing", async () => {
    const { ready, markPassed, log } = build(job({}), { mode: "dry_run" });
    expect(await ready.process(notice)).toEqual({ status: "would_move" });
    expect(markPassed).not.toHaveBeenCalled();
    expect(log.info).toHaveBeenCalledOnce();
  });
});
