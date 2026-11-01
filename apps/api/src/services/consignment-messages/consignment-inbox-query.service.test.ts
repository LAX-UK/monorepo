import { describe, expect, it, vi } from "vitest";
import {
  OTHER_SUBMISSION_ID,
  SUBMISSION_ID,
  THREAD_NOW,
  consignmentThreadFixture,
} from "../../testing/consignment-thread-fixture.js";

const at = (iso: string) => new Date(iso);
const specialistViewer = {
  userId: "clara",
  role: "staff" as const,
  staffRoles: ["specialist" as const],
};

function threadWithEverything() {
  const fixture = consignmentThreadFixture();
  const { messages } = fixture;
  messages.seedMessage({
    submissionId: SUBMISSION_ID,
    side: "client",
    authorUserId: "lena",
    body: "Any news about the frame?",
    at: at("2026-10-28T09:00:00Z"),
  });
  messages.seedMessage({
    submissionId: SUBMISSION_ID,
    side: "staff",
    authorUserId: "clara",
    body: "Checking with the framer.",
    at: at("2026-10-28T10:00:00Z"),
  });
  messages.seedMessage({
    submissionId: SUBMISSION_ID,
    side: "staff",
    authorUserId: "clara",
    body: "Framer is slow, chase on Friday",
    at: at("2026-10-28T10:05:00Z"),
    visibility: "internal",
  });
  messages.seedMessage({
    submissionId: SUBMISSION_ID,
    side: "client",
    authorUserId: "lena",
    body: "Thanks, and the valuation?",
    at: at("2026-10-29T09:00:00Z"),
  });
  return fixture;
}

describe("the inbox list", () => {
  it("presents a waiting thread with its reference, wait, clock and who has it", async () => {
    const { queries } = threadWithEverything();
    const response = await queries.list("clara", {
      view: "unanswered",
      limit: 50,
      offset: 0,
    });
    expect(response).toMatchObject({ total: 1, view: "unanswered", sort: "waiting" });
    expect(response.data[0]).toMatchObject({
      submissionId: SUBMISSION_ID,
      title: "Thames at low tide",
      reference: "C-2041",
      status: "waiting_on_us",
      unread: true,
      account: { id: expect.any(String), name: "Northbank Gallery", kind: "organisation" },
      assignee: { userId: "clara", name: "Clara Mendes", covering: false },
      lastMessage: {
        side: "client",
        authorFirstName: "Lena",
        excerpt: "Thanks, and the valuation?",
        hasAttachment: false,
        at: "2026-10-29T09:00:00.000Z",
      },
      clock: {
        state: "on_track",
        waitingSince: "2026-10-29T09:00:00.000Z",
        waitedMinutes: expect.any(Number),
      },
    });
  });

  it("defaults the record views to the latest activity and honours a chosen sort", async () => {
    const { queries } = threadWithEverything();
    expect((await queries.list("clara", { view: "all", limit: 10, offset: 0 })).sort).toBe(
      "latest",
    );
    expect(
      (await queries.list("clara", { view: "all", sort: "sale_date", limit: 10, offset: 0 })).sort,
    ).toBe("sale_date");
  });

  it("shows an answered thread without a clock, and the cover instead of the specialist", async () => {
    const { queries, commands, messages } = threadWithEverything();
    await commands.reply("clara", SUBMISSION_ID, {
      body: "Valuation next week.",
      attachments: [],
      visibility: "thread",
      sendAnyway: false,
    });
    await commands.assign("clara", SUBMISSION_ID, { assignedToUserId: "omar", covering: true });
    const response = await queries.list("clara", { view: "all", limit: 10, offset: 0 });
    expect(response.data[0]).toMatchObject({
      status: "answered",
      clock: null,
      unread: false,
      assignee: { userId: "omar", covering: true },
      lastMessage: { side: "staff", authorFirstName: "Clara" },
    });
    expect(messages.threads.get(SUBMISSION_ID)?.covering).toBe("omar");
  });

  it("marks a closed thread closed, whoever wrote last", async () => {
    const { queries, commands } = threadWithEverything();
    await commands.close("clara", SUBMISSION_ID);
    const response = await queries.list("clara", { view: "closed", limit: 10, offset: 0 });
    expect(response.data[0]?.status).toBe("closed");
    expect(response.data[0]?.clock).toBeNull();
  });

  it("asks the reader once for the page and once for the counts", async () => {
    const { queries, inbox } = threadWithEverything();
    const list = vi.spyOn(inbox, "list");
    const facets = vi.spyOn(inbox, "facets");
    await queries.list("clara", { view: "all", limit: 10, offset: 0 });
    expect(list).toHaveBeenCalledTimes(1);
    expect(facets).toHaveBeenCalledTimes(1);
  });
});

describe("the summary", () => {
  it("counts the viewer's waiting threads, which are overdue, and the unassigned", async () => {
    const { queries, messages } = threadWithEverything();
    // A second consignment nobody has, whose client wrote long ago.
    messages.seedSubject({
      ...(messages.subjects.get(SUBMISSION_ID) ?? (undefined as never)),
      submissionId: OTHER_SUBMISSION_ID,
      referenceNumber: 2042,
      specialist: null,
    });
    messages.seedMessage({
      submissionId: OTHER_SUBMISSION_ID,
      side: "client",
      authorUserId: "lena",
      body: "Hello?",
      at: at("2026-10-20T09:00:00Z"),
    });
    const summary = await queries.summary("clara");
    expect(summary).toEqual({
      unanswered: 2,
      mine: { waiting: 1, overdue: 0, oldestWaitingSince: "2026-10-29T09:00:00.000Z" },
      unassigned: {
        waiting: 1,
        oldestWaitingSince: "2026-10-20T09:00:00.000Z",
        oldestAccountName: "Northbank Gallery",
      },
    });
    expect(THREAD_NOW.getTime()).toBeGreaterThan(at("2026-10-29T09:00:00Z").getTime());
  });

  it("calls a thread overdue once a working day has passed", async () => {
    const { queries, messages } = consignmentThreadFixture({
      now: () => at("2026-11-02T10:00:00Z"),
    });
    messages.seedMessage({
      submissionId: SUBMISSION_ID,
      side: "client",
      authorUserId: "lena",
      body: "Hello?",
      at: at("2026-10-29T09:00:00Z"),
    });
    expect((await queries.summary("clara")).mine).toMatchObject({ waiting: 1, overdue: 1 });
  });
});

describe("one thread", () => {
  it("shows staff the notes and held replies, with who wrote and in what role", async () => {
    const { queries } = threadWithEverything();
    const result = await queries.detail(specialistViewer, SUBMISSION_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const detail = result.value;
    expect(detail.messages.map((m) => [m.visibility, m.side, m.body])).toEqual([
      ["thread", "client", "Any news about the frame?"],
      ["thread", "staff", "Checking with the framer."],
      ["internal", "staff", "Framer is slow, chase on Friday"],
      ["thread", "client", "Thanks, and the valuation?"],
    ]);
    expect(detail.messages[0]?.author).toEqual({
      userId: "lena",
      name: "Lena Fischer",
      role: "Northbank Gallery, consignor",
    });
    expect(detail.messages[1]?.author.role).toBe("Specialist");
    expect(detail.unread).toBe(2);
    expect(detail.lastMessageId).toBe(detail.messages[3]?.id);
    expect(detail.status).toBe("waiting_on_us");
    expect(detail.clock).toMatchObject({ waitingSince: "2026-10-29T09:00:00.000Z" });
  });

  it("composes the panel: facts, people, specialist and history", async () => {
    const { queries, commands } = threadWithEverything();
    await commands.assign("clara", SUBMISSION_ID, { assignedToUserId: "omar", covering: false });
    await commands.close("omar", SUBMISSION_ID);
    const result = await queries.detail(specialistViewer, SUBMISSION_ID);
    if (!result.ok) throw new Error("not found");
    expect(result.value).toMatchObject({
      submission: { id: SUBMISSION_ID, reference: "C-2041", title: "Thames at low tide" },
      account: { name: "Northbank Gallery" },
      facts: { stage: "approved", artistLine: "Oil on canvas, 1998", estimate: null },
      people: {
        sender: { name: "Lena Fischer", role: "Consignor, sent this work" },
        alsoNotified: ["Olivia Owner"],
        accountConsignmentCount: 14,
      },
      specialist: { userId: "omar" },
      assignee: { userId: "omar", covering: false },
      status: "closed",
      closed: { by: { userId: "omar" } },
      events: [{ kind: "assigned" }, { kind: "closed" }],
    });
  });

  it("derives what the viewer may do from their roles", async () => {
    const { queries } = threadWithEverything();
    const abilities = async (role: "specialist" | "read_only" | "finance" | "cataloguer") => {
      const result = await queries.detail(
        { userId: "x", role: "staff", staffRoles: [role] },
        SUBMISSION_ID,
      );
      return result.ok ? result.value.abilities : null;
    };
    expect(await abilities("specialist")).toEqual({
      canReply: true,
      canAssign: true,
      canClose: true,
    });
    for (const role of ["read_only", "finance", "cataloguer"] as const) {
      expect(await abilities(role)).toEqual({ canReply: false, canAssign: false, canClose: false });
    }
  });

  it("answers Not found for an unknown consignment", async () => {
    const { queries } = threadWithEverything();
    expect(await queries.detail(specialistViewer, OTHER_SUBMISSION_ID)).toMatchObject({
      ok: false,
      status: 404,
    });
  });

  it("opens a consignment nobody has written about yet as an empty thread", async () => {
    const { queries } = consignmentThreadFixture();
    const result = await queries.detail(specialistViewer, SUBMISSION_ID);
    expect(result).toMatchObject({
      ok: true,
      value: { messages: [], lastMessageId: null, unread: 0, clock: null, status: "answered" },
    });
  });
});

describe("assignable colleagues", () => {
  it("lists staff who answer clients with their open threads, not finance", async () => {
    const { queries } = threadWithEverything();
    expect(await queries.assignees()).toEqual([
      { userId: "clara", name: "Clara Mendes", staffRole: "specialist", openCount: 1 },
      { userId: "omar", name: "Omar Reyes", staffRole: "client_services", openCount: 0 },
    ]);
  });
});
