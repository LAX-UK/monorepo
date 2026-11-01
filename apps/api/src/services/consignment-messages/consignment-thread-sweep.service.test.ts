import { REPLY_NOTICE_SWEEP_GRACE_MS } from "@auction/domain";
import { describe, expect, it, vi } from "vitest";
import {
  SUBMISSION_ID,
  THREAD_NOW,
  consignmentThreadFixture,
} from "../../testing/consignment-thread-fixture.js";
import { ConsignmentAssignmentService } from "./consignment-assignment.service.js";
import { ConsignmentThreadAudit } from "./consignment-thread-audit.js";
import { ConsignmentThreadSweepService } from "./consignment-thread-sweep.service.js";

const MINUTE = 60_000;
const agoMs = (ms: number) => new Date(THREAD_NOW.getTime() - ms);

function threadWithReply(deliverAfter: Date | null) {
  const fixture = consignmentThreadFixture();
  fixture.messages.seedMessage({
    submissionId: SUBMISSION_ID,
    side: "client",
    authorUserId: "lena",
    body: "Any news?",
    at: agoMs(60 * MINUTE),
  });
  const replyId = fixture.messages.seedMessage({
    submissionId: SUBMISSION_ID,
    side: "staff",
    authorUserId: "clara",
    body: "Next week.",
    at: agoMs(30 * MINUTE),
    deliverAfter,
  });
  return { ...fixture, replyId };
}

describe("the notice sweep", () => {
  it("tells the account about a reply whose delivery job was lost, once", async () => {
    const { sweep, notifier, messages, replyId } = threadWithReply(agoMs(10 * MINUTE));

    expect(await sweep.sweep()).toEqual({ repliesNotified: 1, coversEnded: 0 });
    expect(notifier.specialistWrote).toHaveBeenCalledOnce();
    expect(notifier.specialistWrote).toHaveBeenCalledWith(
      expect.objectContaining({ authorName: "Clara Mendes", body: "Next week." }),
    );
    expect(messages.messages.find((m) => m.id === replyId)?.notifiedAt).toEqual(THREAD_NOW);

    expect(await sweep.sweep()).toEqual({ repliesNotified: 0, coversEnded: 0 });
    expect(notifier.specialistWrote).toHaveBeenCalledOnce();
  });

  it("does not tell twice when the delivery job got there first", async () => {
    const { sweep, commands, notifier, replyId } = threadWithReply(agoMs(10 * MINUTE));
    await commands.deliver(replyId);
    expect(await sweep.sweep()).toMatchObject({ repliesNotified: 0 });
    expect(notifier.specialistWrote).toHaveBeenCalledOnce();
  });

  it("leaves replies still held, just released, or never held", async () => {
    for (const deliverAfter of [
      new Date(THREAD_NOW.getTime() + 5_000),
      agoMs(REPLY_NOTICE_SWEEP_GRACE_MS / 2),
      null,
    ]) {
      const { sweep, notifier } = threadWithReply(deliverAfter);
      expect(await sweep.sweep()).toMatchObject({ repliesNotified: 0 });
      expect(notifier.specialistWrote).not.toHaveBeenCalled();
    }
  });

  it("skips a reply that was taken back, and internal notes", async () => {
    const { sweep, notifier, messages } = threadWithReply(agoMs(10 * MINUTE));
    messages.seedMessage({
      submissionId: SUBMISSION_ID,
      side: "staff",
      authorUserId: "clara",
      body: "Call the owner first.",
      at: agoMs(20 * MINUTE),
      visibility: "internal",
      deliverAfter: agoMs(10 * MINUTE),
    });
    // Taking the reply back removes it before the hold ends.
    messages.messages.splice(
      messages.messages.findIndex((m) => m.body === "Next week."),
      1,
    );
    expect(await sweep.sweep()).toMatchObject({ repliesNotified: 0 });
    expect(notifier.specialistWrote).not.toHaveBeenCalled();
  });

  it("keeps going when one notice fails, and reports it", async () => {
    const { messages, commands, assignment } = threadWithReply(agoMs(10 * MINUTE));
    const second = messages.seedMessage({
      submissionId: SUBMISSION_ID,
      side: "staff",
      authorUserId: "clara",
      body: "And a photo.",
      at: agoMs(25 * MINUTE),
      deliverAfter: agoMs(9 * MINUTE),
    });
    const onError = vi.fn();
    const sweep = new ConsignmentThreadSweepService({
      messages,
      deliver: async (id) => {
        if (id === second) throw new Error("mail is down");
        return commands.deliver(id);
      },
      assignment,
      onError,
      now: () => THREAD_NOW,
    });
    expect(await sweep.sweep()).toMatchObject({ repliesNotified: 1 });
    expect(onError).toHaveBeenCalledOnce();
  });
});

describe("the cover sweep", () => {
  async function coveredThread(coveringUntil: string | null) {
    const fixture = threadWithReply(null);
    await fixture.commands.assign("clara", SUBMISSION_ID, {
      assignedToUserId: "omar",
      covering: true,
      ...(coveringUntil ? { coveringUntil } : {}),
    });
    return fixture;
  }

  it("returns the thread to the specialist once the end date has passed, and records it", async () => {
    const { messages, events } = await coveredThread("2026-10-30T00:00:00.000Z");
    const later = new ConsignmentAssignmentService({
      messages,
      audit: new ConsignmentThreadAudit(events),
      now: () => new Date("2026-10-30T00:00:01Z"),
    });

    expect(await later.endElapsedCovers()).toBe(1);
    expect(messages.threads.get(SUBMISSION_ID)).toMatchObject({
      covering: null,
      coveringUntil: null,
    });
    expect(messages.events.at(-1)).toMatchObject({
      kind: "assigned",
      actorUserId: null,
      subjectUserId: "clara",
    });
    expect(events.publish).toHaveBeenLastCalledWith(
      expect.objectContaining({
        eventType: "consignment_thread.assigned",
        actorUserId: null,
        payload: expect.objectContaining({ assignedToUserId: "clara", covering: false }),
      }),
    );
    expect(await later.endElapsedCovers()).toBe(0);
  });

  it("leaves a cover that has not reached its end, and one with no end date", async () => {
    const dated = await coveredThread("2026-11-05T00:00:00.000Z");
    expect(await dated.sweep.sweep()).toMatchObject({ coversEnded: 0 });
    expect(dated.messages.threads.get(SUBMISSION_ID)?.covering).toBe("omar");

    const open = await coveredThread(null);
    expect(await open.sweep.sweep()).toMatchObject({ coversEnded: 0 });
    expect(open.messages.threads.get(SUBMISSION_ID)?.covering).toBe("omar");
  });
});

describe("reassigning from the consignment page", () => {
  it("moves the thread with the consignment and leaves the history and the trail", async () => {
    const { assignment, messages, events } = threadWithReply(null);
    expect(
      await assignment.assign("clara", SUBMISSION_ID, {
        assignedToUserId: "omar",
        covering: false,
      }),
    ).toBe("changed");
    expect(messages.subjects.get(SUBMISSION_ID)?.specialist?.userId).toBe("omar");
    expect(messages.events.map((e) => [e.kind, e.subjectUserId])).toEqual([["assigned", "omar"]]);
    expect(events.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "consignment_thread.assigned" }),
    );
  });
});
