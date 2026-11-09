import type { EnquiryDealRecord } from "@auction/domain";
import { describe, expect, it, vi } from "vitest";
import type {
  IKycRetentionSubjectStore,
  RecordCounts,
  RetentionCandidate,
  RetentionHolding,
} from "../interfaces/kyc-retention-subject.store.js";
import { purgeKycRetentionJob } from "./purge-kyc-retention.js";

const NOW = new Date("2030-06-15T00:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
/** Closed exactly five years before NOW, moved by whole days. */
const closedDaysFromBoundary = (days: number) => {
  const d = new Date(NOW);
  d.setUTCFullYear(d.getUTCFullYear() - 5);
  return new Date(d.getTime() + days * DAY);
};

function createStore(
  candidates: RetentionCandidate[],
  keys: string[] = ["sof/a.pdf"],
  deals: Record<string, EnquiryDealRecord[]> = {},
) {
  const held = new Set(candidates.map((c) => c.subjectId));
  const erase = vi.fn(async (subjectId: string): Promise<RecordCounts> => {
    held.delete(subjectId);
    return { kyc_verification: 1 };
  });
  const store: IKycRetentionSubjectStore = {
    kind: "person",
    async listCandidates({ closedBefore, afterId, limit }) {
      return candidates
        .filter((c) => c.closedAt < closedBefore && held.has(c.subjectId))
        .filter((c) => afterId === null || c.subjectId > afterId)
        .sort((a, b) => a.subjectId.localeCompare(b.subjectId))
        .slice(0, limit);
    },
    async dealRecords(subjectId) {
      return deals[subjectId] ?? [];
    },
    async describeHolding(subjectId): Promise<RetentionHolding> {
      return held.has(subjectId)
        ? { records: { kyc_verification: 1, upload_object: keys.length }, storageKeys: keys }
        : { records: {}, storageKeys: [] };
    },
    erase,
  };
  return { store, erase };
}

const log = () => ({ info: vi.fn(), error: vi.fn() });
const person = (subjectId: string, closedAt: Date, lastActivityAt: Date | null = null) => ({
  subjectId,
  closedAt,
  lastActivityAt,
});

describe("purgeKycRetentionJob", () => {
  it("does not purge one day before five years", async () => {
    const { store, erase } = createStore([person("u1", closedDaysFromBoundary(1))]);
    const storage = { deleteObject: vi.fn() };
    const result = await purgeKycRetentionJob({
      stores: [store],
      storage,
      log: log(),
      dryRun: false,
      privateSaleRetentionYears: 5,
      now: NOW,
    });
    expect(result).toMatchObject({ due: 0, purged: 0 });
    expect(erase).not.toHaveBeenCalled();
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it("purges one day after five years, files first", async () => {
    const { store, erase } = createStore([person("u1", closedDaysFromBoundary(-1))]);
    const order: string[] = [];
    const storage = { deleteObject: vi.fn(async () => void order.push("file")) };
    erase.mockImplementationOnce(async () => {
      order.push("rows");
      return { kyc_verification: 1 };
    });
    const result = await purgeKycRetentionJob({
      stores: [store],
      storage,
      log: log(),
      dryRun: false,
      privateSaleRetentionYears: 5,
      now: NOW,
    });
    expect(result).toMatchObject({ due: 1, purged: 1, failed: 0 });
    expect(order).toEqual(["file", "rows"]);
    expect(erase).toHaveBeenCalledWith("u1", {
      relationshipEndedAt: closedDaysFromBoundary(-1),
      purgedAt: NOW,
    });
  });

  it("waits for the later date when activity followed the closure", async () => {
    const { store, erase } = createStore([
      person("u1", closedDaysFromBoundary(-400), closedDaysFromBoundary(1)),
    ]);
    const result = await purgeKycRetentionJob({
      stores: [store],
      storage: { deleteObject: vi.fn() },
      log: log(),
      dryRun: false,
      privateSaleRetentionYears: 5,
      now: NOW,
    });
    expect(result.purged).toBe(0);
    expect(erase).not.toHaveBeenCalled();
  });

  it("deletes nothing in a dry run but reports what is due", async () => {
    const { store, erase } = createStore([person("u1", closedDaysFromBoundary(-1))]);
    const storage = { deleteObject: vi.fn() };
    const logger = log();
    const result = await purgeKycRetentionJob({
      stores: [store],
      storage,
      log: logger,
      dryRun: true,
      privateSaleRetentionYears: 5,
      now: NOW,
    });
    expect(result).toEqual({
      dryRun: true,
      due: 1,
      heldForDeals: 0,
      purged: 0,
      failed: 0,
    });
    expect(erase).not.toHaveBeenCalled();
    expect(storage.deleteObject).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ subjectId: "u1", files: 1 }),
      "kyc_retention_purge_would_purge",
    );
  });

  it("is idempotent: a second run finds nothing", async () => {
    const { store, erase } = createStore([person("u1", closedDaysFromBoundary(-1))]);
    const storage = { deleteObject: vi.fn() };
    const run = () =>
      purgeKycRetentionJob({
        stores: [store],
        storage,
        log: log(),
        dryRun: false,
        privateSaleRetentionYears: 5,
        now: NOW,
      });
    expect((await run()).purged).toBe(1);
    expect(await run()).toMatchObject({ due: 0, purged: 0 });
    expect(erase).toHaveBeenCalledTimes(1);
    expect(storage.deleteObject).toHaveBeenCalledTimes(1);
  });

  it("purges at most one batch per run and finishes the rest next run", async () => {
    const { store, erase } = createStore(
      ["a", "b", "c"].map((id) => person(id, closedDaysFromBoundary(-1))),
    );
    const run = () =>
      purgeKycRetentionJob({
        stores: [store],
        storage: { deleteObject: vi.fn() },
        log: log(),
        dryRun: false,
        privateSaleRetentionYears: 5,
        batchSize: 2,
        now: NOW,
      });
    expect((await run()).purged).toBe(2);
    expect((await run()).purged).toBe(1);
    expect(erase).toHaveBeenCalledTimes(3);
  });

  it("keeps the rows when a file cannot be deleted, and fails the run so it retries", async () => {
    const { store, erase } = createStore([
      person("a", closedDaysFromBoundary(-1)),
      person("b", closedDaysFromBoundary(-1)),
    ]);
    const storage = {
      deleteObject: vi
        .fn()
        .mockRejectedValueOnce(new Error("storage down"))
        .mockResolvedValue(undefined),
    };
    await expect(
      purgeKycRetentionJob({
        stores: [store],
        storage,
        log: log(),
        dryRun: false,
        privateSaleRetentionYears: 5,
        now: NOW,
      }),
    ).rejects.toThrow("failed for 1 subject");
    expect(erase).toHaveBeenCalledTimes(1);
    expect(erase).toHaveBeenCalledWith("b", expect.anything());
  });

  it("skips a subject that holds nothing", async () => {
    const { store, erase } = createStore([person("u1", closedDaysFromBoundary(-1))], []);
    store.describeHolding = async () => ({ records: {}, storageKeys: [] });
    const result = await purgeKycRetentionJob({
      stores: [store],
      storage: { deleteObject: vi.fn() },
      log: log(),
      dryRun: false,
      privateSaleRetentionYears: 5,
      now: NOW,
    });
    expect(result.due).toBe(0);
    expect(erase).not.toHaveBeenCalled();
  });
});

describe("purgeKycRetentionJob and private sale deals", () => {
  /** The person closed six years ago, so their own five years have run out. */
  const expired = (id: string) => person(id, closedDaysFromBoundary(-365));
  const yearsBefore = (years: number, days = 0) => {
    const d = new Date(NOW);
    d.setUTCFullYear(d.getUTCFullYear() - years);
    return new Date(d.getTime() + days * DAY);
  };
  const settledDeal = (endedAt: Date | null): EnquiryDealRecord => ({
    stage: "settled",
    agreedAt: yearsBefore(8),
    endedAt,
    hasComplianceCase: true,
  });
  const run = (
    store: IKycRetentionSubjectStore,
    over: { dryRun?: boolean; privateSaleRetentionYears?: number } = {},
  ) =>
    purgeKycRetentionJob({
      stores: [store],
      storage: { deleteObject: vi.fn() },
      log: log(),
      dryRun: false,
      privateSaleRetentionYears: 5,
      now: NOW,
      ...over,
    });

  it("keeps the evidence of a party while the deal is open, however old their own relationship", async () => {
    const open: EnquiryDealRecord = {
      stage: "paid",
      agreedAt: yearsBefore(7),
      endedAt: null,
      hasComplianceCase: true,
    };
    const { store, erase } = createStore([expired("u1")], ["sof/a.pdf"], { u1: [open] });
    const result = await run(store);
    expect(result).toMatchObject({ due: 0, heldForDeals: 1, purged: 0 });
    expect(erase).not.toHaveBeenCalled();
  });

  it("keeps the evidence until the deal's retention has run from its end", async () => {
    const { store, erase } = createStore([expired("u1")], ["sof/a.pdf"], {
      u1: [settledDeal(yearsBefore(5, 1))],
    });
    expect(await run(store)).toMatchObject({ heldForDeals: 1, purged: 0 });
    expect(erase).not.toHaveBeenCalled();
  });

  it("purges once both the person's five years and the deal's retention have ended", async () => {
    const { store, erase } = createStore([expired("u1")], ["sof/a.pdf"], {
      u1: [settledDeal(yearsBefore(5, -1))],
    });
    expect(await run(store)).toMatchObject({ due: 1, heldForDeals: 0, purged: 1 });
    expect(erase).toHaveBeenCalledTimes(1);
  });

  it("keeps the evidence of a buyer who was named and replaced, as long as the deal's record", async () => {
    // The store reads the party history, so a replaced buyer's deals are listed like any other.
    const { store, erase } = createStore([expired("replaced-buyer")], ["sof/a.pdf"], {
      "replaced-buyer": [
        { stage: "offer", agreedAt: null, endedAt: null, hasComplianceCase: true },
      ],
    });
    expect(await run(store)).toMatchObject({ heldForDeals: 1, purged: 0 });
    expect(erase).not.toHaveBeenCalled();
  });

  it("follows a longer configured retention", async () => {
    const deals = { u1: [settledDeal(yearsBefore(6))] };
    const short = createStore([expired("u1")], ["sof/a.pdf"], deals);
    expect(await run(short.store, { privateSaleRetentionYears: 5 })).toMatchObject({ purged: 1 });
    const long = createStore([expired("u1")], ["sof/a.pdf"], deals);
    expect(await run(long.store, { privateSaleRetentionYears: 10 })).toMatchObject({
      heldForDeals: 1,
      purged: 0,
    });
  });

  it("is unaffected for someone on no deal, or only on a deal withdrawn before agreement with no check", async () => {
    const withdrawn: EnquiryDealRecord = {
      stage: "cancelled",
      agreedAt: null,
      endedAt: yearsBefore(1),
      hasComplianceCase: false,
    };
    const { store, erase } = createStore([expired("plain"), expired("withdrawn")], ["sof/a.pdf"], {
      withdrawn: [withdrawn],
    });
    expect(await run(store)).toMatchObject({ due: 2, heldForDeals: 0, purged: 2 });
    expect(erase).toHaveBeenCalledTimes(2);
  });

  it("purges the person who is not held while holding the one who is, in one run", async () => {
    const open: EnquiryDealRecord = {
      stage: "invoiced",
      agreedAt: yearsBefore(7),
      endedAt: null,
      hasComplianceCase: true,
    };
    const { store, erase } = createStore([expired("held"), expired("free")], ["sof/a.pdf"], {
      held: [open],
    });
    expect(await run(store)).toMatchObject({ due: 1, heldForDeals: 1, purged: 1 });
    expect(erase).toHaveBeenCalledWith("free", expect.anything());
  });

  it("holds in a dry run too, so the log shows what would really be purged", async () => {
    const open: EnquiryDealRecord = {
      stage: "paid",
      agreedAt: yearsBefore(7),
      endedAt: null,
      hasComplianceCase: true,
    };
    const { store, erase } = createStore([expired("u1")], ["sof/a.pdf"], { u1: [open] });
    expect(await run(store, { dryRun: true })).toMatchObject({ due: 0, heldForDeals: 1 });
    expect(erase).not.toHaveBeenCalled();
  });
});
