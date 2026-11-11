import { describe, expect, it } from "vitest";
import {
  PRODUCT_ID,
  REGISTER_ID,
  entry,
  fakeWorld,
  inState,
} from "../../../../testing/zoho-status-fakes.js";
import { CrmGatewayError } from "../../../crm/crm-gateway-error.js";
import { reportOf } from "./zoho-status-sync.js";

const DAY = 24 * 60 * 60 * 1000;

describe("ZohoStatusSync: a Status staff set is never written over", () => {
  it("leaves a Reserved set by hand when an unpublish would make it Withdrawn", async () => {
    const w = fakeWorld({
      zohoStatus: "Reserved",
      written: "Available",
      source: {
        entry: inState("withdrawn"),
        lastMove: { at: new Date("2026-11-02T00:00:00Z"), from: "lax_art", to: "withdrawn" },
      },
    });
    const [outcome] = await w.sync().sync([REGISTER_ID]);
    expect(outcome).toMatchObject({
      kind: "conflict",
      zohoStatus: "Reserved",
      wanted: "Withdrawn",
    });
    expect(w.products.write).not.toHaveBeenCalled();
    expect(w.world.zoho?.status).toBe("Reserved");
  });

  it("leaves a Sold set by hand", async () => {
    const w = fakeWorld({
      zohoStatus: "Sold",
      written: "In Auction",
      source: { entry: inState("held"), lastMove: null },
    });
    const [outcome] = await w.sync().sync([REGISTER_ID]);
    expect(outcome?.kind).toBe("conflict");
    expect(w.products.write).not.toHaveBeenCalled();
  });

  it("raises a From Zoho conflict naming both Statuses", async () => {
    const w = fakeWorld({
      zohoStatus: "Sold",
      written: null,
      source: { entry: inState("bid_sale"), lastMove: null },
    });
    await w.sync().sync([REGISTER_ID]);
    expect(w.register.recordCatalogueStatusConflict).toHaveBeenCalledWith(
      expect.objectContaining({
        registerId: REGISTER_ID,
        zohoStatus: "Sold",
        laxStatus: "In Auction",
      }),
    );
    expect(w.world.conflict).toEqual({ zohoStatus: "Sold", laxStatus: "In Auction" });
    expect(w.register.recordCatalogueStatusWritten).not.toHaveBeenCalled();
  });

  it("leaves a Status LAX has never written and does not know", async () => {
    const w = fakeWorld({
      zohoStatus: "On Loan",
      source: { entry: inState("lax_art"), lastMove: null },
    });
    const [outcome] = await w.sync().sync([REGISTER_ID]);
    expect(outcome?.kind).toBe("conflict");
    expect(w.products.write).not.toHaveBeenCalled();
  });
});

describe("ZohoStatusSync: writes when Zoho still shows LAX's value or Available", () => {
  it("writes when Zoho shows Available", async () => {
    const w = fakeWorld({
      zohoStatus: "Available",
      source: { entry: inState("bid_sale"), lastMove: null },
    });
    const [outcome] = await w.sync().sync([REGISTER_ID]);
    expect(outcome).toMatchObject({ kind: "written", status: "In Auction" });
    expect(w.products.write).toHaveBeenCalledWith(PRODUCT_ID, "In Auction");
  });

  it("writes over the Status it wrote itself", async () => {
    const w = fakeWorld({
      zohoStatus: "Reserved",
      written: "Reserved",
      source: { entry: inState("sold"), lastMove: null },
    });
    await w.sync().sync([REGISTER_ID]);
    expect(w.products.write).toHaveBeenCalledWith(PRODUCT_ID, "Sold");
  });

  it("records what it wrote, so the next compare works", async () => {
    const w = fakeWorld({
      zohoStatus: "Available",
      source: { entry: inState("private_sale"), lastMove: null },
    });
    await w.sync().sync([REGISTER_ID]);
    expect(w.world.written).toBe("Reserved");
    // The artwork then moves on: Zoho still shows what LAX wrote, so LAX may replace it.
    w.world.source = { entry: inState("sold"), lastMove: null };
    const [outcome] = await w.sync().sync([REGISTER_ID]);
    expect(outcome).toMatchObject({ kind: "written", status: "Sold" });
  });

  it("closes the open conflict once it writes", async () => {
    const w = fakeWorld({
      zohoStatus: "Available",
      conflict: { zohoStatus: "Reserved", laxStatus: "In Auction" },
      source: { entry: inState("bid_sale"), lastMove: null },
    });
    await w.sync().sync([REGISTER_ID]);
    expect(w.world.conflict).toBeNull();
  });
});

describe("ZohoStatusSync: Where it is, not the raw state", () => {
  const withdrawnAt = new Date("2026-10-01T00:00:00Z");
  const source = {
    entry: inState("withdrawn"),
    lastMove: { at: withdrawnAt, from: "lax_art" as const, to: "withdrawn" as const },
  };

  it("shows Withdrawn inside the 30 days", async () => {
    const w = fakeWorld({ zohoStatus: "Available", source });
    const [outcome] = await w
      .sync("live", () => new Date(withdrawnAt.getTime() + 29 * DAY))
      .sync([REGISTER_ID]);
    expect(outcome).toMatchObject({ kind: "written", status: "Withdrawn" });
  });

  it("returns to Available after the 30 days, through the same compare-and-set", async () => {
    const w = fakeWorld({ zohoStatus: "Withdrawn", written: "Withdrawn", source });
    const [outcome] = await w
      .sync("live", () => new Date(withdrawnAt.getTime() + 31 * DAY))
      .sync([REGISTER_ID]);
    expect(outcome).toMatchObject({ kind: "written", status: "Available" });
    expect(w.world.zoho?.status).toBe("Available");
  });

  it("does not return a Reserved staff set to Available, even after the window", async () => {
    const w = fakeWorld({ zohoStatus: "Reserved", written: "Withdrawn", source });
    const [outcome] = await w
      .sync("live", () => new Date(withdrawnAt.getTime() + 31 * DAY))
      .sync([REGISTER_ID]);
    expect(outcome).toMatchObject({
      kind: "conflict",
      zohoStatus: "Reserved",
      wanted: "Available",
    });
    expect(w.products.write).not.toHaveBeenCalled();
  });

  it("with no record of when it was withdrawn, keeps Withdrawn", async () => {
    const w = fakeWorld({
      zohoStatus: "Available",
      source: { entry: inState("withdrawn"), lastMove: null },
    });
    const [outcome] = await w.sync().sync([REGISTER_ID]);
    expect(outcome).toMatchObject({ kind: "written", status: "Withdrawn" });
  });
});

describe("ZohoStatusSync: idempotent and ordered", () => {
  it("sends once however often it runs", async () => {
    const w = fakeWorld({
      zohoStatus: "Available",
      source: { entry: inState("bid_sale"), lastMove: null },
    });
    const sync = w.sync();
    await sync.sync([REGISTER_ID]);
    const [again] = await sync.sync([REGISTER_ID]);
    expect(again?.kind).toBe("in_sync");
    expect(w.products.write).toHaveBeenCalledTimes(1);
  });

  it("records the written Status when Zoho already held it, without sending", async () => {
    const w = fakeWorld({
      zohoStatus: "Sold",
      written: null,
      source: { entry: inState("sold"), lastMove: null },
    });
    const [outcome] = await w.sync().sync([REGISTER_ID]);
    expect(outcome?.kind).toBe("in_sync");
    expect(w.products.write).not.toHaveBeenCalled();
    expect(w.world.written).toBe("Sold");
  });

  it("does not touch the register when nothing differs and nothing is open", async () => {
    const w = fakeWorld({
      zohoStatus: "In Auction",
      written: "In Auction",
      source: { entry: inState("bid_sale"), lastMove: null },
    });
    await w.sync().sync([REGISTER_ID]);
    expect(w.register.recordCatalogueStatusWritten).not.toHaveBeenCalled();
  });

  it("closes a conflict staff settled by setting Zoho to the Status LAX wants", async () => {
    const w = fakeWorld({
      zohoStatus: "In Auction",
      written: "In Auction",
      conflict: { zohoStatus: "Sold", laxStatus: "In Auction" },
      source: { entry: inState("bid_sale"), lastMove: null },
    });
    await w.sync().sync([REGISTER_ID]);
    expect(w.world.conflict).toBeNull();
  });

  it("serialises per artwork and reads the register after taking the lock", async () => {
    const order: string[] = [];
    const w = fakeWorld({ source: { entry: inState("bid_sale"), lastMove: null } });
    w.lock.withLock.mockImplementation(async (_ids, fn) => {
      order.push("lock");
      return fn();
    });
    w.sources.readStatusSources.mockImplementation(async () => {
      order.push("read facts");
      return w.world.source ? [w.world.source] : [];
    });
    w.products.read.mockImplementation(async () => {
      order.push("read zoho");
      return new Map();
    });
    await w.sync().sync([REGISTER_ID]);
    expect(order).toEqual(["lock", "read facts", "read zoho"]);
  });

  it("drops a write when Zoho changed after the facts were read: never older over newer", async () => {
    const w = fakeWorld({
      zohoStatus: "Available",
      source: { entry: inState("bid_sale"), lastMove: null },
    });
    w.world.zoho = { status: "Available", modifiedAt: new Date(NOW_PLUS_1S) };
    const [outcome] = await w.sync().sync([REGISTER_ID]);
    expect(outcome?.kind).toBe("stale");
    expect(w.products.write).not.toHaveBeenCalled();
  });

  it("writes when Zoho's last change is before the facts were read", async () => {
    const w = fakeWorld({
      zohoStatus: "Available",
      source: { entry: inState("bid_sale"), lastMove: null },
    });
    w.world.zoho = { status: "Available", modifiedAt: new Date("2026-11-03T11:00:00Z") };
    expect((await w.sync().sync([REGISTER_ID]))[0]?.kind).toBe("written");
  });
});

describe("ZohoStatusSync: compare-and-set re-reads the Product just before writing", () => {
  const before = { status: "Available", modifiedAt: new Date("2026-11-03T11:00:00Z") };

  function changing(after: { status: string | null; modifiedAt: Date | null }) {
    const w = fakeWorld({ source: { entry: inState("bid_sale"), lastMove: null } });
    w.world.zoho = before;
    let reads = 0;
    w.products.read.mockImplementation(async () => {
      reads += 1;
      return new Map([[PRODUCT_ID, reads === 1 ? before : after]]);
    });
    return w;
  }

  it("reads again before sending, and sends when nothing changed", async () => {
    const w = fakeWorld({ source: { entry: inState("bid_sale"), lastMove: null } });
    w.world.zoho = before;
    expect((await w.sync().sync([REGISTER_ID]))[0]?.kind).toBe("written");
    expect(w.products.read).toHaveBeenCalledTimes(2);
    expect(w.products.write).toHaveBeenCalledTimes(1);
  });

  it("does not send when staff changed the Status after the decision", async () => {
    const w = changing({ status: "Sold", modifiedAt: new Date("2026-11-03T11:00:00Z") });
    expect((await w.sync().sync([REGISTER_ID]))[0]?.kind).toBe("stale");
    expect(w.products.write).not.toHaveBeenCalled();
    expect(w.register.recordCatalogueStatusWritten).not.toHaveBeenCalled();
  });

  it("does not send when Modified_Time moved, even though the Status looks the same", async () => {
    const w = changing({ status: "Available", modifiedAt: new Date("2026-11-03T11:59:00Z") });
    expect((await w.sync().sync([REGISTER_ID]))[0]?.kind).toBe("stale");
    expect(w.products.write).not.toHaveBeenCalled();
  });

  it("reports a Product deleted between the two reads as a failure that will not pass", async () => {
    const w = fakeWorld({ source: { entry: inState("bid_sale"), lastMove: null } });
    w.world.zoho = before;
    let reads = 0;
    w.products.read.mockImplementation(async () => {
      reads += 1;
      return reads === 1 ? new Map([[PRODUCT_ID, before]]) : new Map();
    });
    expect((await w.sync().sync([REGISTER_ID]))[0]).toMatchObject({
      kind: "failed",
      code: "product_not_found",
      retryable: false,
    });
    expect(w.products.write).not.toHaveBeenCalled();
  });

  it("sends nothing and reads once in a dry run", async () => {
    const w = fakeWorld({ source: { entry: inState("bid_sale"), lastMove: null } });
    await w.sync("dry_run").sync([REGISTER_ID]);
    expect(w.products.read).toHaveBeenCalledTimes(1);
    expect(w.products.write).not.toHaveBeenCalled();
  });
});

const NOW_PLUS_1S = "2026-11-03T12:00:01.000Z";

describe("ZohoStatusSync: modes and failures", () => {
  it("in a dry run reads and decides but sends and records nothing", async () => {
    const w = fakeWorld({
      zohoStatus: "Available",
      source: { entry: inState("bid_sale"), lastMove: null },
    });
    const [outcome] = await w.sync("dry_run").sync([REGISTER_ID]);
    expect(outcome).toMatchObject({ kind: "written", status: "In Auction" });
    expect(w.products.write).not.toHaveBeenCalled();
    expect(w.register.recordCatalogueStatusWritten).not.toHaveBeenCalled();
  });

  it("in a dry run raises no conflict", async () => {
    const w = fakeWorld({
      zohoStatus: "Sold",
      source: { entry: inState("bid_sale"), lastMove: null },
    });
    const [outcome] = await w.sync("dry_run").sync([REGISTER_ID]);
    expect(outcome?.kind).toBe("conflict");
    expect(w.register.recordCatalogueStatusConflict).not.toHaveBeenCalled();
  });

  it("reports a Product Zoho no longer has as a failure that will not pass", async () => {
    const w = fakeWorld({ zoho: undefined });
    const [outcome] = await w.sync().sync([REGISTER_ID]);
    expect(outcome).toMatchObject({ kind: "failed", code: "product_not_found", retryable: false });
  });

  it("reports a refused write as a failure and records nothing", async () => {
    const w = fakeWorld({
      zohoStatus: "Available",
      source: { entry: inState("bid_sale"), lastMove: null },
    });
    w.products.write.mockRejectedValue(
      new CrmGatewayError({
        code: "TOO_MANY_REQUESTS",
        message: "slow",
        status: 429,
        retryable: true,
      }),
    );
    const [outcome] = await w.sync().sync([REGISTER_ID]);
    expect(outcome).toMatchObject({ kind: "failed", code: "TOO_MANY_REQUESTS", retryable: true });
    expect(w.register.recordCatalogueStatusWritten).not.toHaveBeenCalled();
  });

  it("skips a print group, whose record is not a Product", async () => {
    const w = fakeWorld({
      source: {
        entry: entry({ kind: "print", stockCode: "LAX-PRT-PH-GAC-26-0001", sourceOriginalId: "o" }),
        lastMove: null,
      },
    });
    const [outcome] = await w.sync().sync([REGISTER_ID]);
    expect(outcome).toMatchObject({ kind: "skipped", reason: "print_group_not_a_product" });
    expect(w.products.read).not.toHaveBeenCalled();
  });

  it("skips a record the register no longer has", async () => {
    const w = fakeWorld({ source: null });
    expect((await w.sync().sync([REGISTER_ID]))[0]).toMatchObject({
      kind: "skipped",
      reason: "register_entry_missing",
    });
  });
});

describe("reportOf", () => {
  it("counts each kind of outcome", () => {
    const who = { registerId: "r", stockCode: "S", zohoProductId: "p" };
    const report = reportOf([
      { ...who, kind: "written", status: "Sold" },
      { ...who, kind: "in_sync" },
      { ...who, kind: "conflict", zohoStatus: "Sold", wanted: "Available" },
      { ...who, kind: "stale" },
      { ...who, kind: "skipped", reason: "register_entry_missing" },
      { ...who, kind: "failed", code: "X", retryable: true },
    ]);
    expect(report).toMatchObject({ checked: 6, written: 1, unchanged: 2, conflicts: 1, stale: 1 });
    expect(report.failures).toEqual([
      { registerId: "r", stockCode: "S", code: "X", retryable: true },
    ]);
  });
});
