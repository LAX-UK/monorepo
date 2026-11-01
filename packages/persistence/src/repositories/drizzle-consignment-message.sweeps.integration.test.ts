import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import {
  consignmentMessage,
  consignmentThread,
  consignmentThreadEvent,
  itemSubmission,
  legalEntity,
  user,
} from "@auction/db/schema";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DrizzleConsignmentMessageRepository } from "./drizzle-consignment-message.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);
const MINUTE = 60_000;

describe.skipIf(!HAS_DB)("consignment thread sweeps (integration)", () => {
  const run = randomUUID().slice(0, 8);
  const userIds = [`sweep_specialist_${run}`, `sweep_cover_${run}`, `sweep_client_${run}`];
  const [specialistId, coverId, clientId] = userIds as [string, string, string];
  const entityId = randomUUID();
  const now = new Date("2026-11-10T12:00:00Z");

  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const repo = new DrizzleConsignmentMessageRepository(db);
  const submissionIds: string[] = [];

  async function threadOnNewSubmission(cover: { until: Date | null } | null) {
    const submissionId = randomUUID();
    submissionIds.push(submissionId);
    await db.insert(itemSubmission).values({
      id: submissionId,
      title: `Sweep ${run}`,
      legalEntityId: entityId,
      assignedToUserId: specialistId,
    });
    const [thread] = await db
      .insert(consignmentThread)
      .values({
        submissionId,
        lastMessageAt: now,
        lastMessageSide: "client",
        coveringUserId: cover ? coverId : null,
        coveringUntil: cover?.until ?? null,
      })
      .returning({ id: consignmentThread.id });
    return { submissionId, threadId: thread?.id as string };
  }

  async function reply(
    threadId: string,
    options: { deliverAfter: Date | null; visibility?: "thread" | "internal"; notified?: boolean },
  ) {
    const [row] = await db
      .insert(consignmentMessage)
      .values({
        threadId,
        authorUserId: specialistId,
        authorSide: "staff",
        body: "Next week.",
        visibility: options.visibility ?? "thread",
        deliverAfter: options.deliverAfter,
        notifiedAt: options.notified ? now : null,
      })
      .returning({ id: consignmentMessage.id });
    return row?.id as string;
  }

  beforeAll(async () => {
    const t = new Date();
    await db.insert(user).values(
      userIds.map((id) => ({
        id,
        name: id,
        email: `${id}@integration.test`,
        emailVerified: true,
        createdAt: t,
        updatedAt: t,
      })),
    );
    await db.insert(legalEntity).values({
      id: entityId,
      displayName: `Sweep gallery ${run}`,
      kind: "organisation",
      subkind: "gallery",
      createdByUserId: clientId,
    });
  });

  afterAll(async () => {
    if (submissionIds.length > 0) {
      await db.delete(itemSubmission).where(inArray(itemSubmission.id, submissionIds));
    }
    await db.delete(legalEntity).where(eq(legalEntity.id, entityId));
    await db.delete(user).where(inArray(user.id, userIds));
  });

  describe("endElapsedCovers", () => {
    it("returns an elapsed cover to the specialist, records it, and finds nothing the second time", async () => {
      const { submissionId, threadId } = await threadOnNewSubmission({
        until: new Date(now.getTime() - MINUTE),
      });

      const ended = await repo.endElapsedCovers(now);
      expect(ended.map((cover) => cover.submissionId)).toContain(submissionId);
      expect(ended.find((cover) => cover.submissionId === submissionId)?.specialist?.userId).toBe(
        specialistId,
      );

      const [thread] = await db
        .select({
          covering: consignmentThread.coveringUserId,
          until: consignmentThread.coveringUntil,
        })
        .from(consignmentThread)
        .where(eq(consignmentThread.id, threadId));
      expect(thread).toEqual({ covering: null, until: null });
      const events = await db
        .select({
          kind: consignmentThreadEvent.kind,
          actor: consignmentThreadEvent.actorUserId,
          subject: consignmentThreadEvent.subjectUserId,
        })
        .from(consignmentThreadEvent)
        .where(eq(consignmentThreadEvent.threadId, threadId));
      expect(events).toEqual([{ kind: "assigned", actor: null, subject: specialistId }]);

      const again = await repo.endElapsedCovers(now);
      expect(again.map((cover) => cover.submissionId)).not.toContain(submissionId);
    });

    it("leaves a cover that has not reached its end and one with no end date", async () => {
      const future = await threadOnNewSubmission({ until: new Date(now.getTime() + MINUTE) });
      const open = await threadOnNewSubmission({ until: null });

      const ended = await repo.endElapsedCovers(now);
      const endedIds = ended.map((cover) => cover.submissionId);
      expect(endedIds).not.toContain(future.submissionId);
      expect(endedIds).not.toContain(open.submissionId);
      const [stillCovered] = await db
        .select({ covering: consignmentThread.coveringUserId })
        .from(consignmentThread)
        .where(inArray(consignmentThread.id, [future.threadId, open.threadId]));
      expect(stillCovered?.covering).toBe(coverId);
    });

    it("does not end the same cover twice when two sweeps run at once", async () => {
      const { submissionId, threadId } = await threadOnNewSubmission({
        until: new Date(now.getTime() - MINUTE),
      });

      const [a, b] = await Promise.all([repo.endElapsedCovers(now), repo.endElapsedCovers(now)]);

      const times = [...a, ...b].filter((cover) => cover.submissionId === submissionId).length;
      expect(times).toBe(1);
      const events = await db
        .select({ id: consignmentThreadEvent.id })
        .from(consignmentThreadEvent)
        .where(eq(consignmentThreadEvent.threadId, threadId));
      expect(events).toHaveLength(1);
    });
  });

  describe("listOverdueReplyNotices", () => {
    it("lists unannounced staff replies whose hold ended by the cutoff, oldest first", async () => {
      const { threadId } = await threadOnNewSubmission(null);
      const newer = await reply(threadId, { deliverAfter: new Date(now.getTime() - 5 * MINUTE) });
      const older = await reply(threadId, { deliverAfter: new Date(now.getTime() - 9 * MINUTE) });

      const ids = await repo.listOverdueReplyNotices(now, 500);

      expect(ids.filter((id) => id === older || id === newer)).toEqual([older, newer]);
    });

    it("skips held, announced, never-held and internal rows", async () => {
      const { threadId } = await threadOnNewSubmission(null);
      const held = await reply(threadId, { deliverAfter: new Date(now.getTime() + MINUTE) });
      const announced = await reply(threadId, {
        deliverAfter: new Date(now.getTime() - MINUTE),
        notified: true,
      });
      const neverHeld = await reply(threadId, { deliverAfter: null });
      const note = await reply(threadId, {
        deliverAfter: new Date(now.getTime() - MINUTE),
        visibility: "internal",
      });

      const ids = await repo.listOverdueReplyNotices(now, 500);

      for (const id of [held, announced, neverHeld, note]) expect(ids).not.toContain(id);
    });

    it("hands each overdue reply to the atomic claim once, however often it is listed", async () => {
      const { threadId } = await threadOnNewSubmission(null);
      const id = await reply(threadId, { deliverAfter: new Date(now.getTime() - MINUTE) });
      expect(await repo.listOverdueReplyNotices(now, 500)).toContain(id);

      const [first, second] = await Promise.all([
        repo.claimReplyNotice(id, now),
        repo.claimReplyNotice(id, now),
      ]);

      expect([first, second].filter(Boolean)).toHaveLength(1);
      expect(await repo.listOverdueReplyNotices(now, 500)).not.toContain(id);
      expect(await repo.claimReplyNotice(id, now)).toBeNull();
    });

    it("never claims a held reply or a note", async () => {
      const { threadId } = await threadOnNewSubmission(null);
      const held = await reply(threadId, { deliverAfter: new Date(now.getTime() + MINUTE) });
      const note = await reply(threadId, {
        deliverAfter: new Date(now.getTime() - MINUTE),
        visibility: "internal",
      });

      expect(await repo.claimReplyNotice(held, now)).toBeNull();
      expect(await repo.claimReplyNotice(note, now)).toBeNull();
    });

    it("respects the batch limit", async () => {
      const { threadId } = await threadOnNewSubmission(null);
      await reply(threadId, { deliverAfter: new Date(now.getTime() - MINUTE) });
      await reply(threadId, { deliverAfter: new Date(now.getTime() - MINUTE) });

      expect(await repo.listOverdueReplyNotices(now, 1)).toHaveLength(1);
    });
  });
});
