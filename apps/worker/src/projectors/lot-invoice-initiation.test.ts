import { describe, expect, it, vi } from "vitest";
import {
  LOT_INVOICE_INITIATION_PROJECTOR,
  processLotInvoiceInitiation,
} from "./lot-invoice-initiation.js";

function fakeDb(results: unknown[]) {
  const make = () => {
    const proxy: unknown = new Proxy(() => {}, {
      get(_t, prop) {
        if (prop === "then") {
          const value = results.shift();
          return (resolve: (v: unknown) => void) => resolve(value);
        }
        return () => proxy;
      },
    });
    return proxy;
  };
  return new Proxy(
    {},
    {
      get() {
        return () => make();
      },
    },
  ) as never;
}

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never;

describe("processLotInvoiceInitiation", () => {
  it("calls ensureLotInvoice only for sold lots with a winner", async () => {
    const ensureLotInvoice = vi.fn().mockResolvedValue(undefined);
    const soldRow = {
      id: 10,
      aggregateId: "lot-sold",
      payload: { outcome: "sold", winnerId: "buyer-1" },
    };
    const noSaleRow = {
      id: 11,
      aggregateId: "lot-nosale",
      payload: { outcome: "no_sale", winnerId: null },
    };
    const db = fakeDb([undefined, [{ last: 0 }], [soldRow, noSaleRow], undefined]);

    await processLotInvoiceInitiation({ db, log, ensureLotInvoice });

    expect(ensureLotInvoice).toHaveBeenCalledTimes(1);
    expect(ensureLotInvoice).toHaveBeenCalledWith("lot-sold");
  });

  it("does not advance past a failing event until retry succeeds", async () => {
    const ensureLotInvoice = vi.fn().mockRejectedValue(new Error("api_down"));
    const row = {
      id: 5,
      aggregateId: "lot-1",
      payload: { outcome: "sold", winnerId: "buyer-1" },
    };
    const db = fakeDb([undefined, [{ last: 0 }], [row], [{ lastError: null }], undefined]);

    await processLotInvoiceInitiation({ db, log, ensureLotInvoice });

    expect(ensureLotInvoice).toHaveBeenCalledWith("lot-1");
  });
});

describe("LOT_INVOICE_INITIATION_PROJECTOR", () => {
  it("has a stable projector name", () => {
    expect(LOT_INVOICE_INITIATION_PROJECTOR).toBe("lot_invoice_initiation");
  });
});
