import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { failedJobs } from "@auction/db/schema";
import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { DrizzleFailedJobReviewRepository } from "./drizzle-failed-job-review.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);
const DAY = 86_400_000;

describe.skipIf(!HAS_DB)("Failed jobs: groups, count and payload purge (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const repo = new DrizzleFailedJobReviewRepository(db);
  const tag = randomUUID().slice(0, 8);
  const queue = `q-${tag}`;
  const now = Date.now();
  const ids: string[] = [];

  async function add(input: {
    error?: string;
    state?: "needs_review" | "retried" | "discarded";
    resolvedDaysAgo?: number;
  }) {
    const id = `${tag}-${ids.length}`;
    ids.push(id);
    const at = new Date(now - (input.resolvedDaysAgo ?? 0) * DAY);
    await db.insert(failedJobs).values({
      id,
      originalQueue: queue,
      originalJobName: "send",
      payloadJson: JSON.stringify({ lotId: "lot-1" }),
      errorMessage: input.error ?? "Postmark 422\n  at send (x.js:1)",
      attempts: 5,
      firstFailedAt: at,
      failedAt: at,
      ...(input.state === "retried" ? { replayedAt: at, replayedBy: "staff" } : {}),
      ...(input.state === "discarded"
        ? { discardedAt: at, discardedBy: "staff", discardReason: "duplicate" }
        : {}),
    });
    return id;
  }

  const payloadOf = async (id: string) =>
    (await db.select().from(failedJobs).where(eq(failedJobs.id, id)))[0]?.payloadJson;

  afterAll(async () => {
    if (ids.length) await db.delete(failedJobs).where(inArray(failedJobs.id, ids));
  });

  it("counts identical failures across every page, ignoring other views and the page size", async () => {
    await add({ error: "Postmark 422\n  at send (x.js:1)" });
    await add({ error: "  Postmark 422  \r\n  at other" });
    await add({ error: "Postmark 422" });
    await add({ error: "Timed out" });
    await add({ error: "Postmark 422", state: "discarded" });

    const result = await repo.search({
      view: "needs_review",
      sort: "failed_desc",
      q: queue,
      limit: 1,
      offset: 0,
    });
    expect(result.rows).toHaveLength(1);
    expect(
      result.groups
        .map((group) => [group.errorLine, group.count])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    ).toEqual([
      ["Postmark 422", 3],
      ["Timed out", 1],
    ]);
  });

  it("counts jobs waiting for review in one count", async () => {
    const before = await repo.countNeedsReview();
    await add({ error: "counted once" });
    await add({ error: "not counted", state: "retried" });
    await add({ error: "not counted either", state: "discarded" });
    expect(await repo.countNeedsReview()).toBe(before + 1);
  });

  it("clears the payload only of jobs resolved before the cutoff", async () => {
    const oldDiscard = await add({ state: "discarded", resolvedDaysAgo: 120 });
    const oldRetry = await add({ state: "retried", resolvedDaysAgo: 91 });
    const recentDiscard = await add({ state: "discarded", resolvedDaysAgo: 30 });
    const oldWaiting = await add({ resolvedDaysAgo: 400 });

    const cutoff = new Date(now - 90 * DAY);
    const cleared = await repo.purgeResolvedPayloads(cutoff, 500);

    expect(cleared).toBeGreaterThanOrEqual(2);
    expect(await payloadOf(oldDiscard)).toBeNull();
    expect(await payloadOf(oldRetry)).toBeNull();
    expect(await payloadOf(recentDiscard)).not.toBeNull();
    expect(await payloadOf(oldWaiting)).not.toBeNull();
    // A second run finds nothing of ours left to clear, and the record itself stays.
    await repo.purgeResolvedPayloads(cutoff, 500);
    expect((await repo.findManyForReview([oldDiscard]))[0]?.discardReason).toBe("duplicate");
  });

  it("clears at most the batch it was given", async () => {
    const a = await add({ state: "discarded", resolvedDaysAgo: 200 });
    const b = await add({ state: "discarded", resolvedDaysAgo: 200 });
    const cleared = await repo.purgeResolvedPayloads(new Date(now - 90 * DAY), 1);
    expect(cleared).toBe(1);
    const left = [await payloadOf(a), await payloadOf(b)].filter((p) => p !== null);
    expect(left).toHaveLength(1);
  });
});
