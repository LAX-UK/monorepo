import { describe, expect, it } from "vitest";
import {
  PRODUCT_ID,
  REGISTER_ID,
  entry,
  fakeWorld,
  inState,
} from "../../../../testing/zoho-status-fakes.js";
import { CrmGatewayError } from "../../../crm/crm-gateway-error.js";
import { ZOHO_AUTOMATION_CHANGED_STATUS, reportOf } from "./zoho-status-sync.js";

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

  it("does not record a Status LAX did not send as written, even when Zoho already holds it", async () => {
    const w = fakeWorld({
      zohoStatus: "Sold",
      written: null,
      source: { entry: inState("sold"), lastMove: null },
    });
    const [outcome] = await w.sync().sync([REGISTER_ID]);
    expect(outcome?.kind).toBe("in_sync");
    expect(w.products.write).not.toHaveBeenCalled();
    expect(w.world.written).toBeNull();
    expect(w.register.recordCatalogueStatusWritten).not.toHaveBeenCalled();
  });

  it("never writes over staff's Sold after LAX moved on (two-step regression)", async () => {
    const w = fakeWorld({
      zohoStatus: "Sold",
      written: null,
      source: { entry: inState("sold"), lastMove: null },
    });
    const sync = w.sync();
    await sync.sync([REGISTER_ID]);
    w.world.source = { entry: inState("lax_art"), lastMove: null };
    const [outcome] = await sync.sync([REGISTER_ID]);
    expect(outcome).toMatchObject({ kind: "conflict", zohoStatus: "Sold" });
    expect(w.products.write).not.toHaveBeenCalled();
  });

  it("never writes over staff's Reserved when a private sale becomes a bid sale", async () => {
    const w = fakeWorld({
      zohoStatus: "Reserved",
      written: null,
      source: { entry: inState("private_sale"), lastMove: null },
    });
    const sync = w.sync();
    await sync.sync([REGISTER_ID]);
    w.world.source = { entry: inState("bid_sale"), lastMove: null };
    const [outcome] = await sync.sync([REGISTER_ID]);
    expect(outcome?.kind).toBe("conflict");
    expect(w.products.write).not.toHaveBeenCalled();
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

  it("treats a Modified_Time a few seconds ahead as clock skew, not a newer change", async () => {
    const w = fakeWorld({
      zohoStatus: "Available",
      source: { entry: inState("bid_sale"), lastMove: null },
    });
    w.world.zoho = { status: "Available", modifiedAt: new Date("2026-11-03T12:00:02.000Z") };
    const [outcome] = await w.sync().sync([REGISTER_ID]);
    expect(outcome?.kind).toBe("written");
  });

  it("drops a write when Zoho changed after the facts were read: never older over newer", async () => {
    const w = fakeWorld({
      zohoStatus: "Available",
      source: { entry: inState("bid_sale"), lastMove: null },
    });
    w.world.zoho = { status: "Available", modifiedAt: new Date(NOW_PLUS_10S) };
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
    // The decision's read, the one just before the write, and the check after it.
    expect(w.products.read).toHaveBeenCalledTimes(3);
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

const NOW_PLUS_10S = "2026-11-03T12:00:10.000Z";

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

describe("ZohoStatusSync: a sale made in the gallery is Zoho's", () => {
  const gallerySold = () =>
    entry({ offer: { state: "sold", ref: { kind: "gallery_sale", id: PRODUCT_ID } } });

  it("never writes Sold back when staff changed Zoho's Status after a gallery sale", async () => {
    const w = fakeWorld({
      zohoStatus: "Available",
      written: null,
      source: { entry: gallerySold(), lastMove: null },
    });
    const [outcome] = await w.sync().sync([REGISTER_ID]);
    expect(outcome).toMatchObject({ kind: "skipped", reason: "gallery_sale_owned_by_zoho" });
    expect(w.products.write).not.toHaveBeenCalled();
    expect(w.register.recordCatalogueStatusConflict).not.toHaveBeenCalled();
    expect(w.world.zoho?.status).toBe("Available");
  });

  it("is in sync while Zoho still says Sold", async () => {
    const w = fakeWorld({
      zohoStatus: "Sold",
      source: { entry: gallerySold(), lastMove: null },
    });
    const [outcome] = await w.sync().sync([REGISTER_ID]);
    expect(outcome?.kind).toBe("in_sync");
    expect(w.products.write).not.toHaveBeenCalled();
  });
});

describe("ZohoStatusSync: checks the Product again after writing", () => {
  const STAFF = "5000000000000099001";
  const INTEGRATION_USER = "5000000000000011001";

  /** A staff edit Zoho applies in the same moment as LAX's update: LAX's write, then staff's. */
  function staffRacesTheWrite(staffStatus: string) {
    const w = fakeWorld({ source: { entry: inState("bid_sale"), lastMove: null } });
    w.products.write.mockImplementationOnce(async () => {
      w.world.zoho = {
        status: staffStatus,
        modifiedAt: new Date("2026-11-03T12:00:01Z"),
        modifiedBy: STAFF,
      };
    });
    return w;
  }

  it("raises the conflict, with both values, when staff changed the Status in the write's window", async () => {
    const w = staffRacesTheWrite("Sold");
    const [outcome] = await w.sync().sync([REGISTER_ID]);
    expect(outcome).toMatchObject({
      kind: "conflict",
      zohoStatus: "Sold",
      wanted: "In Auction",
      changedDuringWrite: true,
      changedBy: STAFF,
    });
    expect(w.register.recordCatalogueStatusConflict).toHaveBeenCalledWith(
      expect.objectContaining({
        registerId: REGISTER_ID,
        zohoStatus: "Sold",
        laxStatus: "In Auction",
      }),
    );
    expect(w.world.conflict).toEqual({ zohoStatus: "Sold", laxStatus: "In Auction" });
    expect(reportOf(outcome ? [outcome] : [])).toMatchObject({ conflicts: 1, written: 0 });
  });

  it("restores nothing: staff's Status stays and LAX sends once", async () => {
    const w = staffRacesTheWrite("Reserved");
    await w.sync().sync([REGISTER_ID]);
    expect(w.products.write).toHaveBeenCalledTimes(1);
    expect(w.world.zoho?.status).toBe("Reserved");
  });

  it("records what it sent, so a staff value equal to an older write is not overwritten next pass", async () => {
    const w = staffRacesTheWrite("Reserved");
    w.world.written = "Reserved";
    w.world.zoho = { status: "Reserved", modifiedAt: null };
    w.world.source = { entry: inState("sold"), lastMove: null };
    await w.sync().sync([REGISTER_ID]);
    expect(w.world.written).toBe("Sold");
    const [next] = await w.sync().sync([REGISTER_ID]);
    expect(next).toMatchObject({ kind: "conflict", zohoStatus: "Reserved", wanted: "Sold" });
    expect(w.products.write).toHaveBeenCalledTimes(1);
  });

  it("is written, with no conflict, when the Product still shows what LAX sent", async () => {
    const w = fakeWorld({ source: { entry: inState("bid_sale"), lastMove: null } });
    const [outcome] = await w.sync().sync([REGISTER_ID]);
    expect(outcome).toMatchObject({ kind: "written", status: "In Auction" });
    expect(outcome).not.toHaveProperty("changedDuringWrite");
    expect(w.register.recordCatalogueStatusConflict).not.toHaveBeenCalled();
  });

  it("raises no conflict for a Status compare-and-set would replace anyway (Available)", async () => {
    const w = staffRacesTheWrite("Available");
    const [outcome] = await w.sync().sync([REGISTER_ID]);
    expect(outcome).toMatchObject({ kind: "written", status: "In Auction" });
    expect(w.register.recordCatalogueStatusConflict).not.toHaveBeenCalled();
    expect(w.products.write).toHaveBeenCalledTimes(1);
  });

  it("keeps the write when the check after it cannot read Zoho", async () => {
    const w = fakeWorld({ source: { entry: inState("bid_sale"), lastMove: null } });
    let reads = 0;
    const read = w.products.read.getMockImplementation();
    w.products.read.mockImplementation(async (ids: readonly string[]) => {
      reads += 1;
      if (reads === 3)
        throw new CrmGatewayError({
          code: "TOO_MANY_REQUESTS",
          message: "slow",
          status: 429,
          retryable: true,
        });
      return read?.(ids);
    });
    const [outcome] = await w.sync().sync([REGISTER_ID]);
    expect(outcome).toMatchObject({ kind: "written", status: "In Auction" });
    expect(w.world.written).toBe("In Auction");
    expect(w.log.warn).toHaveBeenCalledWith(expect.anything(), "zoho_status_write_check_failed");
  });

  it("does not check after writing in a dry run", async () => {
    const w = fakeWorld({ source: { entry: inState("bid_sale"), lastMove: null } });
    await w.sync("dry_run").sync([REGISTER_ID]);
    expect(w.products.read).toHaveBeenCalledTimes(1);
  });
  describe("Modified_Time is the evidence of a change", () => {
    const BEFORE = new Date("2026-11-03T11:00:00Z");

    /** Zoho shows Withdrawn, which LAX last wrote, so LAX sends In Auction over it. */
    function withdrawnLaxWrote() {
      const w = fakeWorld({ source: { entry: inState("bid_sale"), lastMove: null } });
      w.world.written = "Withdrawn";
      w.world.zoho = { status: "Withdrawn", modifiedAt: BEFORE, modifiedBy: STAFF };
      return w;
    }

    it("raises nothing when the read after the write still shows the state before it (a stale read)", async () => {
      const w = withdrawnLaxWrote();
      const before = w.world.zoho;
      const read = w.products.read.getMockImplementation();
      let reads = 0;
      // The third read (the check) is answered from before the update: same Status, same Modified_Time.
      w.products.read.mockImplementation(async (ids: readonly string[]) => {
        reads += 1;
        return reads === 3 ? new Map([[PRODUCT_ID, before]]) : read?.(ids);
      });
      const [outcome] = await w.sync().sync([REGISTER_ID]);
      expect(outcome).toMatchObject({ kind: "written", status: "In Auction" });
      expect(w.register.recordCatalogueStatusConflict).not.toHaveBeenCalled();
      expect(w.world.conflict).toBeNull();
      expect(w.log.info).toHaveBeenCalledWith(
        expect.objectContaining({ zohoStatus: "Withdrawn", wanted: "In Auction" }),
        "zoho_status_write_unverified",
      );
      expect(w.log.warn).not.toHaveBeenCalled();
      // The next pass reads Zoho afresh and finds what LAX sent.
      const [next] = await w.sync().sync([REGISTER_ID]);
      expect(next).toMatchObject({ kind: "in_sync" });
    });

    it("raises the conflict when Modified_Time moved past the write's re-read (staff)", async () => {
      const w = withdrawnLaxWrote();
      w.products.write.mockImplementationOnce(async () => {
        w.world.zoho = {
          status: "Reserved",
          modifiedAt: new Date("2026-11-03T11:00:02Z"),
          modifiedBy: STAFF,
        };
      });
      w.integrationUserId.mockResolvedValue(INTEGRATION_USER);
      const [outcome] = await w.sync().sync([REGISTER_ID]);
      expect(outcome).toMatchObject({
        kind: "conflict",
        zohoStatus: "Reserved",
        wanted: "In Auction",
        changedDuringWrite: true,
        changedBy: STAFF,
        cause: "staff",
      });
      expect(w.register.recordCatalogueStatusConflict).toHaveBeenCalledWith(
        expect.not.objectContaining({ cause: expect.anything() }),
      );
      expect(w.log.warn).toHaveBeenCalledWith(
        expect.objectContaining({ changedBy: STAFF }),
        "zoho_status_changed_during_write",
      );
    });

    it("raises a change made as the integration user as Zoho automation, never reverting it", async () => {
      const w = withdrawnLaxWrote();
      w.products.write.mockImplementationOnce(async () => {
        w.world.zoho = {
          status: "Reserved",
          modifiedAt: new Date("2026-11-03T11:00:02Z"),
          modifiedBy: INTEGRATION_USER,
        };
      });
      w.integrationUserId.mockResolvedValue(INTEGRATION_USER);
      const [outcome] = await w.sync().sync([REGISTER_ID]);
      expect(outcome).toMatchObject({
        kind: "conflict",
        zohoStatus: "Reserved",
        wanted: "In Auction",
        changedDuringWrite: true,
        changedBy: INTEGRATION_USER,
        cause: "zoho_automation",
      });
      expect(w.register.recordCatalogueStatusConflict).toHaveBeenCalledWith(
        expect.objectContaining({
          zohoStatus: "Reserved",
          laxStatus: "In Auction",
          cause: "zoho_automation",
        }),
      );
      expect(w.log.warn).toHaveBeenCalledWith(
        expect.objectContaining({ label: ZOHO_AUTOMATION_CHANGED_STATUS }),
        "zoho_status_changed_by_automation",
      );
      expect(w.products.write).toHaveBeenCalledTimes(1);
      expect(w.world.zoho?.status).toBe("Reserved");
    });

    it("asks for the integration user only when a change is found", async () => {
      const w = withdrawnLaxWrote();
      await w.sync().sync([REGISTER_ID]);
      expect(w.integrationUserId).not.toHaveBeenCalled();
    });

    it("takes the change to be staff's when the integration user is not known", async () => {
      const w = withdrawnLaxWrote();
      w.products.write.mockImplementationOnce(async () => {
        w.world.zoho = {
          status: "Reserved",
          modifiedAt: new Date("2026-11-03T11:00:02Z"),
          modifiedBy: INTEGRATION_USER,
        };
      });
      w.integrationUserId.mockRejectedValue(new Error("down"));
      const [outcome] = await w.sync().sync([REGISTER_ID]);
      expect(outcome).toMatchObject({ kind: "conflict", cause: "staff" });
    });
  });
});
