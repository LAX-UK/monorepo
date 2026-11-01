import { CONSIGNMENT_REPLY_UNDO_MS } from "@auction/domain";
import { describe, expect, it } from "vitest";
import {
  OTHER_SUBMISSION_ID,
  SUBMISSION_ID,
  THREAD_NOW,
  consignmentThreadFixture,
} from "../../testing/consignment-thread-fixture.js";

const at = (iso: string) => new Date(iso);
const reply = (body: string, extra: Record<string, unknown> = {}) => ({
  body,
  attachments: [],
  visibility: "thread" as const,
  sendAnyway: false,
  ...extra,
});

function waitingThread() {
  const fixture = consignmentThreadFixture();
  const firstId = fixture.messages.seedMessage({
    submissionId: SUBMISSION_ID,
    side: "client",
    authorUserId: "lena",
    body: "Any news?",
    at: at("2026-10-29T09:00:00Z"),
  });
  return { ...fixture, firstId };
}

describe("replying", () => {
  it("holds the reply for the undo window, answers the thread and schedules the notice", async () => {
    const { commands, messages, notifier, delivery, firstId } = waitingThread();
    const result = await commands.reply("clara", SUBMISSION_ID, reply("Next week."));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const holdEnds = new Date(THREAD_NOW.getTime() + CONSIGNMENT_REPLY_UNDO_MS);
    expect(result.value).toMatchObject({
      side: "staff",
      visibility: "thread",
      body: "Next week.",
      undoUntil: holdEnds.toISOString(),
      author: { name: "Clara Mendes", role: "Specialist" },
    });
    expect(delivery.scheduled.get(result.value.id)).toEqual(holdEnds);
    expect(messages.threads.get(SUBMISSION_ID)).toMatchObject({
      lastMessageSide: "staff",
      awaitingSince: null,
    });
    expect(messages.messages.find((m) => m.id === firstId)?.readAt).toEqual(THREAD_NOW);
    expect(notifier.specialistWrote).not.toHaveBeenCalled();
  });

  it("shows undo only to the person who wrote the reply", async () => {
    const { commands, queries, messages } = waitingThread();
    await commands.reply("clara", SUBMISSION_ID, reply("Next week."));
    const asWriter = await queries.detail(
      { userId: "clara", role: "staff", staffRoles: ["specialist"] },
      SUBMISSION_ID,
    );
    const asColleague = await queries.detail(
      { userId: "omar", role: "staff", staffRoles: ["client_services"] },
      SUBMISSION_ID,
    );
    const undo = (r: typeof asWriter) => r.ok && r.value.messages.at(-1)?.undoUntil;
    expect(undo(asWriter)).toEqual(expect.any(String));
    expect(undo(asColleague)).toBeNull();
    expect(messages.messages).toHaveLength(2);
  });

  it("holds a reply written against an older thread, and sends it when asked to anyway", async () => {
    const { commands, messages, firstId } = waitingThread();
    messages.seedMessage({
      submissionId: SUBMISSION_ID,
      side: "client",
      authorUserId: "lena",
      body: "Also, the frame is original.",
      at: at("2026-10-29T09:30:00Z"),
    });
    const held = await commands.reply(
      "clara",
      SUBMISSION_ID,
      reply("Next week.", { lastSeenMessageId: firstId }),
    );
    expect(held).toMatchObject({ ok: false, status: 409, code: "thread_changed" });
    if (held.ok) return;
    expect(held.extra).toMatchObject({
      newMessages: [{ body: "Also, the frame is original.", side: "client" }],
    });
    expect(messages.messages).toHaveLength(2);

    const anyway = await commands.reply(
      "clara",
      SUBMISSION_ID,
      reply("Next week.", { lastSeenMessageId: firstId, sendAnyway: true }),
    );
    expect(anyway.ok).toBe(true);
  });

  it("lets a reply through when nothing is new or the message seen is unknown", async () => {
    const { commands, messages } = waitingThread();
    const newest = messages.messages.at(-1)?.id;
    expect(
      (await commands.reply("clara", SUBMISSION_ID, reply("One", { lastSeenMessageId: newest })))
        .ok,
    ).toBe(true);
    expect(
      (await commands.reply("clara", SUBMISSION_ID, reply("Two", { lastSeenMessageId: "gone" })))
        .ok,
    ).toBe(true);
  });

  it("a reply on a closed thread reopens it as answered and records who", async () => {
    const { commands, messages, events } = waitingThread();
    messages.seedClosed(SUBMISSION_ID, at("2026-10-29T09:10:00Z"));
    await commands.reply("clara", SUBMISSION_ID, reply("Sorry for the wait."));
    expect(messages.threads.get(SUBMISSION_ID)?.closedAt).toBeNull();
    expect(messages.events.map((e) => [e.kind, e.actorUserId])).toEqual([["reopened", "clara"]]);
    expect(events.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "consignment_thread.reopened",
        actorUserId: "clara",
      }),
    );
  });

  it("sends at once, without time to take it back, when the queue is away", async () => {
    const { commands, messages, notifier, delivery } = waitingThread();
    delivery.failScheduling = true;
    const result = await commands.reply("clara", SUBMISSION_ID, reply("Next week."));
    expect(result.ok && result.value.undoUntil).toBeNull();
    expect(notifier.specialistWrote).toHaveBeenCalledOnce();
    expect(messages.messages.at(-1)?.deliverAfter).toEqual(THREAD_NOW);
    expect(messages.messages.at(-1)?.notifiedAt).toEqual(THREAD_NOW);
  });

  it("attaches the writer's own checked uploads, and refuses anyone else's", async () => {
    const { commands, messages } = waitingThread();
    messages.seedUpload({
      id: "u1",
      ownerUserId: "clara",
      kind: "consignment_message_attachment",
      status: "active",
      key: "uploads/valuation.pdf",
    });
    messages.seedUpload({
      id: "u2",
      ownerUserId: "omar",
      kind: "consignment_message_attachment",
      status: "active",
      key: "uploads/other.pdf",
    });
    const sent = await commands.reply(
      "clara",
      SUBMISSION_ID,
      reply("", { attachments: [{ uploadObjectId: "u1", fileName: "valuation.pdf" }] }),
    );
    expect(sent).toMatchObject({
      ok: true,
      value: { attachments: [{ fileName: "valuation.pdf", url: "/f/uploads/valuation.pdf" }] },
    });
    expect(
      await commands.reply(
        "clara",
        SUBMISSION_ID,
        reply("", { attachments: [{ uploadObjectId: "u2" }] }),
      ),
    ).toMatchObject({ ok: false, code: "attachment_invalid" });
  });

  it("names the limit when too many files are attached", async () => {
    const { commands } = waitingThread();
    const attachments = Array.from({ length: 6 }, (_, i) => ({ uploadObjectId: `u${i}` }));
    const result = await commands.reply("clara", SUBMISSION_ID, reply("", { attachments }));
    expect(result).toMatchObject({
      ok: false,
      status: 400,
      code: "attachment_too_many",
      extra: { limit: { maxCount: 5 } },
    });
  });

  it("refuses an empty reply and answers Not found for an unknown consignment", async () => {
    const { commands } = waitingThread();
    expect(await commands.reply("clara", SUBMISSION_ID, reply("  "))).toMatchObject({
      ok: false,
      status: 400,
      code: "message_empty",
    });
    expect(await commands.reply("clara", OTHER_SUBMISSION_ID, reply("Hi"))).toMatchObject({
      ok: false,
      status: 404,
    });
  });
});

describe("internal notes", () => {
  it("are stored for staff only: no markers move, nobody is told, there is nothing to undo", async () => {
    const { commands, messages, notifier, delivery } = waitingThread();
    const before = { ...messages.threads.get(SUBMISSION_ID) };
    const result = await commands.reply(
      "clara",
      SUBMISSION_ID,
      reply("Chasing again, handle with care", { visibility: "internal" }),
    );
    expect(result).toMatchObject({
      ok: true,
      value: { visibility: "internal", undoUntil: null, readAt: null },
    });
    expect(messages.threads.get(SUBMISSION_ID)).toEqual(before);
    expect(messages.messages[0]?.readAt).toBeNull();
    expect(notifier.specialistWrote).not.toHaveBeenCalled();
    expect(delivery.scheduled.size).toBe(0);
  });

  it("do not trigger the changed-while-writing check, and do not reopen a closed thread", async () => {
    const { commands, messages } = waitingThread();
    messages.seedClosed(SUBMISSION_ID, at("2026-10-29T09:10:00Z"));
    const note = await commands.reply(
      "clara",
      SUBMISSION_ID,
      reply("For the file", { visibility: "internal", lastSeenMessageId: "gone" }),
    );
    expect(note.ok).toBe(true);
    expect(messages.threads.get(SUBMISSION_ID)?.closedAt).not.toBeNull();
  });
});

describe("taking a reply back", () => {
  async function sentReply() {
    const fixture = waitingThread();
    const sent = await fixture.commands.reply("clara", SUBMISSION_ID, reply("Next week."));
    if (!sent.ok) throw new Error("reply failed");
    return { ...fixture, messageId: sent.value.id };
  }

  it("removes the reply, forgets its notice and goes back to waiting since the question", async () => {
    const { commands, messages, delivery, messageId } = await sentReply();
    expect(await commands.undo("clara", SUBMISSION_ID, messageId)).toEqual({
      ok: true,
      value: { undone: true },
    });
    expect(messages.messages.map((m) => m.body)).toEqual(["Any news?"]);
    expect(delivery.scheduled.size).toBe(0);
    expect(messages.threads.get(SUBMISSION_ID)).toMatchObject({
      lastMessageSide: "client",
      awaitingSince: at("2026-10-29T09:00:00Z"),
    });
  });

  it("no longer works once the reply has gone to the client", async () => {
    const later = consignmentThreadFixture({
      now: () => new Date(THREAD_NOW.getTime() + CONSIGNMENT_REPLY_UNDO_MS + 1),
    });
    later.messages.seedMessage({
      submissionId: SUBMISSION_ID,
      side: "staff",
      authorUserId: "clara",
      body: "Gone",
      at: THREAD_NOW,
      deliverAfter: new Date(THREAD_NOW.getTime() + CONSIGNMENT_REPLY_UNDO_MS),
    });
    const id = later.messages.messages[0]?.id ?? "";
    expect(await later.commands.undo("clara", SUBMISSION_ID, id)).toMatchObject({
      ok: false,
      status: 409,
      code: "undo_expired",
      error: "The reply has already gone to the client.",
    });
    expect(later.messages.messages).toHaveLength(1);
  });

  it("is the writer's alone, and only for replies", async () => {
    const { commands, messages, messageId } = await sentReply();
    expect(await commands.undo("omar", SUBMISSION_ID, messageId)).toMatchObject({
      ok: false,
      status: 409,
      code: "undo_expired",
    });
    const clientMessage = messages.messages[0]?.id ?? "";
    expect(await commands.undo("clara", SUBMISSION_ID, clientMessage)).toMatchObject({
      ok: false,
      status: 409,
    });
    expect(await commands.undo("clara", SUBMISSION_ID, "unknown")).toMatchObject({
      ok: false,
      status: 404,
    });
    expect(await commands.undo("clara", OTHER_SUBMISSION_ID, messageId)).toMatchObject({
      ok: false,
      status: 404,
    });
    expect(messages.messages).toHaveLength(2);
  });
});

describe("telling the account", () => {
  it("tells them once the hold has ended, and only once", async () => {
    const { commands, messages, notifier } = waitingThread();
    const sent = await commands.reply("clara", SUBMISSION_ID, reply("Next week."));
    if (!sent.ok) return;
    await commands.deliver(sent.value.id);
    expect(notifier.specialistWrote).not.toHaveBeenCalled();

    const afterHold = consignmentThreadFixture({
      now: () => new Date(THREAD_NOW.getTime() + CONSIGNMENT_REPLY_UNDO_MS + 500),
    });
    Object.assign(afterHold.messages, { messages: messages.messages, threads: messages.threads });
    afterHold.messages.names.set("clara", "Clara Mendes");
    await afterHold.commands.deliver(sent.value.id);
    await afterHold.commands.deliver(sent.value.id);
    expect(afterHold.notifier.specialistWrote).toHaveBeenCalledOnce();
    expect(afterHold.notifier.specialistWrote).toHaveBeenCalledWith(
      expect.objectContaining({ authorName: "Clara Mendes", body: "Next week." }),
    );
  });

  it("does nothing for a reply that was taken back", async () => {
    const { commands, notifier } = waitingThread();
    const sent = await commands.reply("clara", SUBMISSION_ID, reply("Oops"));
    if (!sent.ok) return;
    await commands.undo("clara", SUBMISSION_ID, sent.value.id);
    await commands.deliver(sent.value.id);
    expect(notifier.specialistWrote).not.toHaveBeenCalled();
  });
});

describe("closing and reopening", () => {
  it("closes once, records it on the thread and the consignment's history", async () => {
    const { commands, messages, events } = waitingThread();
    expect(await commands.close("clara", SUBMISSION_ID)).toEqual({
      ok: true,
      value: { changed: true },
    });
    expect(await commands.close("clara", SUBMISSION_ID)).toEqual({
      ok: true,
      value: { changed: false },
    });
    expect(messages.events.map((e) => e.kind)).toEqual(["closed"]);
    expect(events.publish).toHaveBeenCalledTimes(1);
    expect(events.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateType: "submission",
        aggregateId: SUBMISSION_ID,
        eventType: "consignment_thread.closed",
        actorUserId: "clara",
      }),
    );
  });

  it("reopens a closed thread and is idempotent", async () => {
    const { commands, messages, events } = waitingThread();
    await commands.close("clara", SUBMISSION_ID);
    expect(await commands.reopen("omar", SUBMISSION_ID)).toEqual({
      ok: true,
      value: { changed: true },
    });
    expect(await commands.reopen("omar", SUBMISSION_ID)).toEqual({
      ok: true,
      value: { changed: false },
    });
    expect(messages.threads.get(SUBMISSION_ID)?.closedAt).toBeNull();
    expect(events.publish).toHaveBeenLastCalledWith(
      expect.objectContaining({ eventType: "consignment_thread.reopened", actorUserId: "omar" }),
    );
  });

  it("answers Not found for an unknown consignment and says when nobody has written yet", async () => {
    const { commands, messages } = consignmentThreadFixture();
    expect(await commands.close("clara", OTHER_SUBMISSION_ID)).toMatchObject({ status: 404 });
    expect(await commands.reopen("clara", OTHER_SUBMISSION_ID)).toMatchObject({ status: 404 });
    expect(messages.threads.size).toBe(0);
    expect(await commands.close("clara", SUBMISSION_ID)).toMatchObject({
      ok: false,
      status: 409,
      code: "no_thread",
    });
  });
});

describe("read and unread", () => {
  it("marks the client's messages read, and the newest one unread again", async () => {
    const { commands, messages } = waitingThread();
    expect(await commands.markRead(SUBMISSION_ID)).toEqual({ ok: true, value: { marked: 1 } });
    expect(messages.messages[0]?.readAt).not.toBeNull();
    expect(await commands.markUnread(SUBMISSION_ID)).toEqual({
      ok: true,
      value: { changed: true },
    });
    expect(messages.messages[0]?.readAt).toBeNull();
    expect(await commands.markRead(OTHER_SUBMISSION_ID)).toMatchObject({ status: 404 });
    expect(await commands.markUnread(OTHER_SUBMISSION_ID)).toMatchObject({ status: 404 });
  });

  it("has nothing to mark unread when the client has not written", async () => {
    const { commands } = consignmentThreadFixture();
    expect(await commands.markUnread(SUBMISSION_ID)).toEqual({
      ok: true,
      value: { changed: false },
    });
  });
});

describe("assigning", () => {
  it("gives the consignment to a colleague who answers clients, and records it", async () => {
    const { commands, messages, events } = waitingThread();
    const result = await commands.assign("clara", SUBMISSION_ID, {
      assignedToUserId: "omar",
      covering: false,
    });
    expect(result).toEqual({
      ok: true,
      value: { changed: true, assignee: { userId: "omar", name: "Omar Reyes", covering: false } },
    });
    expect(messages.subjects.get(SUBMISSION_ID)?.specialist?.userId).toBe("omar");
    expect(messages.events.map((e) => [e.kind, e.subjectUserId])).toEqual([["assigned", "omar"]]);
    expect(events.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "consignment_thread.assigned",
        payload: expect.objectContaining({ assignedToUserId: "omar", covering: false }),
      }),
    );
    expect(
      await commands.assign("clara", SUBMISSION_ID, { assignedToUserId: "omar", covering: false }),
    ).toMatchObject({ ok: true, value: { changed: false } });
  });

  it("covers the thread only, then ends the cover by assigning the specialist themself", async () => {
    const { commands, messages } = waitingThread();
    const cover = await commands.assign("clara", SUBMISSION_ID, {
      assignedToUserId: "omar",
      covering: true,
    });
    expect(cover).toMatchObject({
      ok: true,
      value: { changed: true, assignee: { userId: "omar", covering: true } },
    });
    expect(messages.subjects.get(SUBMISSION_ID)?.specialist?.userId).toBe("clara");
    const ended = await commands.assign("clara", SUBMISSION_ID, {
      assignedToUserId: "clara",
      covering: true,
    });
    expect(ended).toMatchObject({
      ok: true,
      value: { changed: true, assignee: { userId: "clara", covering: false } },
    });
    expect(messages.events.map((e) => e.kind)).toEqual(["covering", "assigned"]);
  });

  it("giving the consignment to someone ends any cover, and unassigning leaves nobody", async () => {
    const { commands, messages } = waitingThread();
    await commands.assign("clara", SUBMISSION_ID, { assignedToUserId: "omar", covering: true });
    const given = await commands.assign("clara", SUBMISSION_ID, {
      assignedToUserId: "omar",
      covering: false,
    });
    expect(given).toMatchObject({ value: { assignee: { userId: "omar", covering: false } } });
    expect(messages.threads.get(SUBMISSION_ID)?.covering).toBeNull();
    const none = await commands.assign("clara", SUBMISSION_ID, {
      assignedToUserId: null,
      covering: false,
    });
    expect(none).toMatchObject({ ok: true, value: { assignee: null } });
    expect(messages.events.at(-1)?.kind).toBe("unassigned");
  });

  it("refuses people who do not answer clients, cover with nobody, and cover before a thread exists", async () => {
    const { commands } = waitingThread();
    for (const userId of ["finn", "stranger"]) {
      expect(
        await commands.assign("clara", SUBMISSION_ID, {
          assignedToUserId: userId,
          covering: false,
        }),
      ).toMatchObject({ ok: false, status: 400, code: "assignee_not_eligible" });
    }
    expect(
      await commands.assign("clara", SUBMISSION_ID, { assignedToUserId: null, covering: true }),
    ).toMatchObject({ ok: false, status: 400, code: "covering_needs_person" });
    const empty = consignmentThreadFixture();
    expect(
      await empty.commands.assign("clara", SUBMISSION_ID, {
        assignedToUserId: "omar",
        covering: true,
      }),
    ).toMatchObject({ ok: false, status: 409, code: "no_thread" });
    expect(
      await empty.commands.assign("clara", OTHER_SUBMISSION_ID, {
        assignedToUserId: "omar",
        covering: false,
      }),
    ).toMatchObject({ ok: false, status: 404 });
  });
});

describe("bulk actions", () => {
  function twoThreads() {
    const fixture = waitingThread();
    fixture.messages.seedSubject({
      ...(fixture.messages.subjects.get(SUBMISSION_ID) ?? (undefined as never)),
      submissionId: OTHER_SUBMISSION_ID,
      referenceNumber: 2042,
      specialist: null,
    });
    fixture.messages.seedMessage({
      submissionId: OTHER_SUBMISSION_ID,
      side: "client",
      authorUserId: "lena",
      body: "Hello",
      at: at("2026-10-29T09:15:00Z"),
    });
    return fixture;
  }

  it("closes the chosen threads and counts the ones already closed as skipped", async () => {
    const { commands } = twoThreads();
    await commands.close("clara", OTHER_SUBMISSION_ID);
    const result = await commands.bulk(
      "clara",
      {
        action: "close",
        submissionIds: [SUBMISSION_ID, OTHER_SUBMISSION_ID, "missing"],
      },
      null,
    );
    expect(result).toEqual({ ok: true, value: { changed: 1, skipped: 2 } });
  });

  it("acts on every thread a filter matches", async () => {
    const { commands, messages } = twoThreads();
    const result = await commands.bulk(
      "clara",
      { action: "mark_read", filter: { view: "unanswered" } },
      { view: "unanswered", viewerUserId: "clara" },
    );
    expect(result).toEqual({ ok: true, value: { changed: 2, skipped: 0 } });
    expect(messages.messages.every((m) => m.readAt !== null)).toBe(true);
  });

  it("assigns many threads to a colleague, and refuses someone who does not answer clients", async () => {
    const { commands, messages } = twoThreads();
    const result = await commands.bulk(
      "clara",
      {
        action: "assign",
        submissionIds: [SUBMISSION_ID, OTHER_SUBMISSION_ID],
        assignedToUserId: "omar",
      },
      null,
    );
    expect(result).toEqual({ ok: true, value: { changed: 2, skipped: 0 } });
    expect(messages.subjects.get(OTHER_SUBMISSION_ID)?.specialist?.userId).toBe("omar");
    expect(
      await commands.bulk(
        "clara",
        { action: "assign", submissionIds: [SUBMISSION_ID], assignedToUserId: "finn" },
        null,
      ),
    ).toMatchObject({ ok: false, status: 400, code: "assignee_not_eligible" });
  });
});
