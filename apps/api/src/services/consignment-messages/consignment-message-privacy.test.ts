import { describe, expect, it } from "vitest";
import {
  SUBMISSION_ID,
  THREAD_NOW,
  consignmentThreadFixture,
} from "../../testing/consignment-thread-fixture.js";

const member = (userId = "owner") => ({
  legalEntityId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  userId,
  actor: { role: "owner" as const, isImpersonation: false },
});

const held = new Date(THREAD_NOW.getTime() + 8_000);

function seededThread() {
  const fixture = consignmentThreadFixture();
  const { messages } = fixture;
  messages.seedMessage({
    submissionId: SUBMISSION_ID,
    side: "client",
    authorUserId: "lena",
    body: "Any news?",
    at: new Date("2026-10-29T09:00:00Z"),
  });
  messages.seedMessage({
    submissionId: SUBMISSION_ID,
    side: "staff",
    authorUserId: "clara",
    body: "Client has been chasing, be careful",
    at: new Date("2026-10-29T09:30:00Z"),
    visibility: "internal",
  });
  messages.seedMessage({
    submissionId: SUBMISSION_ID,
    side: "staff",
    authorUserId: "clara",
    body: "Still held back",
    at: new Date("2026-10-29T09:59:55Z"),
    deliverAfter: held,
  });
  return fixture;
}

describe("what the account never sees", () => {
  it("leaves out internal notes and replies still held, and does not count them as unread", async () => {
    const { client } = seededThread();
    const result = await client.readForClient(member(), SUBMISSION_ID);
    expect(result.ok && result.value.messages.map((m) => m.body)).toEqual(["Any news?"]);
    expect(result.ok && result.value.unread).toBe(0);
  });

  it("shows a reply once its hold has ended", async () => {
    const { client, messages } = seededThread();
    const reply = messages.messages.at(-1);
    if (reply) reply.deliverAfter = new Date(THREAD_NOW.getTime() - 1);
    const result = await client.readForClient(member(), SUBMISSION_ID);
    expect(result.ok && result.value.messages.map((m) => m.body)).toEqual([
      "Any news?",
      "Still held back",
    ]);
    expect(result.ok && result.value.unread).toBe(1);
  });

  it("opening the thread marks only what was released, never a note or a held reply", async () => {
    const { client, messages } = seededThread();
    expect(await client.markReadForClient(member(), SUBMISSION_ID)).toEqual({
      ok: true,
      value: { marked: 0 },
    });
    expect(messages.messages.filter((m) => m.authorSide === "staff").map((m) => m.readAt)).toEqual([
      null,
      null,
    ]);
  });

  it("a message from the account reopens a closed thread, tells the cover and records it", async () => {
    const { client, messages, notifier, events } = consignmentThreadFixture();
    messages.seedMessage({
      submissionId: SUBMISSION_ID,
      side: "staff",
      authorUserId: "clara",
      body: "All sorted",
      at: new Date("2026-10-29T08:00:00Z"),
    });
    messages.seedClosed(SUBMISSION_ID, new Date("2026-10-29T08:30:00Z"));
    const thread = messages.threads.get(SUBMISSION_ID);
    if (thread) thread.covering = "omar";
    const result = await client.writeForClient(member(), SUBMISSION_ID, {
      body: "One more thing",
      attachments: [],
    });
    expect(result.ok).toBe(true);
    expect(messages.threads.get(SUBMISSION_ID)).toMatchObject({
      closedAt: null,
      awaitingSince: THREAD_NOW,
    });
    expect(messages.events.map((e) => [e.kind, e.actorUserId])).toEqual([["reopened", null]]);
    expect(events.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateType: "submission",
        eventType: "consignment_thread.reopened",
        actorUserId: null,
      }),
    );
    expect(notifier.clientWrote).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.objectContaining({ covering: { userId: "omar", name: "Omar Reyes" } }),
      }),
    );
  });
});
