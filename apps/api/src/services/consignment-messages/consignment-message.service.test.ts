import type { LegalEntityMemberRole, LegalEntityStatus } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { InMemoryConsignmentMessages } from "../../testing/in-memory-consignment-messages.js";
import {
  CONSIGNMENT_MESSAGE_UPLOAD_KIND,
  ConsignmentMessageService,
  decodeThreadCursor,
  encodeThreadCursor,
} from "./consignment-message.service.js";

const ACCOUNT = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const OTHER_ACCOUNT = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const SUBMISSION = "33333333-3333-4333-8333-333333333333";
const NOW = new Date("2026-10-29T10:00:00Z");

function setup(
  options: {
    sender?: string | null;
    status?: LegalEntityStatus;
    kind?: "individual" | "organisation";
    specialist?: boolean;
  } = {},
) {
  const messages = new InMemoryConsignmentMessages();
  messages.seedSubject({
    submissionId: SUBMISSION,
    title: "Thames at low tide",
    referenceNumber: 2041,
    submittedByUserId: options.sender === undefined ? "lena" : options.sender,
    account: {
      id: ACCOUNT,
      name: "Northbank Gallery",
      kind: options.kind ?? "organisation",
      status: options.status ?? "approved",
    },
    specialist: options.specialist === false ? null : { userId: "clara", name: "Clara Mendes" },
    saleId: null,
  });
  messages.names.set("clara", "Clara Mendes");
  messages.names.set("lena", "Lena Fischer");
  messages.names.set("owner", "Olivia Owner");
  const notifier = {
    specialistWrote: vi.fn().mockResolvedValue(undefined),
    clientWrote: vi.fn().mockResolvedValue(undefined),
  };
  const assigner = { assign: vi.fn().mockResolvedValue({ ok: true }) };
  const links = { linksFor: vi.fn(async (keys: readonly string[]) => keys.map((k) => `/f/${k}`)) };
  const service = new ConsignmentMessageService({
    messages,
    notifier,
    assigner,
    links,
    now: () => NOW,
  });
  return { service, messages, notifier, assigner, links };
}

const member = (role: LegalEntityMemberRole, userId = "owner", isImpersonation = false) => ({
  legalEntityId: ACCOUNT,
  userId,
  actor: { role, isImpersonation },
});

describe("client side", () => {
  it("reads the thread oldest first, with the specialist and the unread count", async () => {
    const { service, messages } = setup();
    messages.seedMessage({
      submissionId: SUBMISSION,
      side: "staff",
      authorUserId: "clara",
      body: "Could you confirm the frame?",
      at: new Date("2026-10-27T09:00:00Z"),
    });
    messages.seedMessage({
      submissionId: SUBMISSION,
      side: "client",
      authorUserId: "lena",
      body: "Yes, it is.",
      at: new Date("2026-10-28T09:00:00Z"),
    });
    const result = await service.readForClient(member("owner"), SUBMISSION);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.specialist).toEqual({ name: "Clara Mendes" });
    expect(result.value.messages.map((m) => [m.side, m.author.name])).toEqual([
      ["staff", "Clara Mendes"],
      ["client", "Lena Fischer"],
    ]);
    expect(result.value.unread).toBe(1);
    expect(result.value.access).toEqual({ canWrite: true, reason: null });
  });

  it("answers Not found for another account's consignment and for one a consignor did not send", async () => {
    const { service } = setup();
    const foreign = await service.readForClient(
      { ...member("owner"), legalEntityId: OTHER_ACCOUNT },
      SUBMISSION,
    );
    expect(foreign).toMatchObject({ ok: false, status: 404 });
    const hidden = await service.readForClient(member("consignor", "someone-else"), SUBMISSION);
    expect(hidden).toMatchObject({ ok: false, status: 404 });
  });

  it("a viewer reads with the reason they cannot write, and reading leaves the task alone", async () => {
    const { service, messages } = setup();
    messages.seedMessage({
      submissionId: SUBMISSION,
      side: "staff",
      authorUserId: "clara",
      body: "Hello",
      at: NOW,
    });
    const read = await service.readForClient(member("viewer", "vic"), SUBMISSION);
    expect(read.ok && read.value.access.canWrite).toBe(false);
    expect(read.ok && read.value.access.reason).toMatch(/Your role can read these messages/);
    const write = await service.writeForClient(member("viewer", "vic"), SUBMISSION, {
      body: "Hi",
      attachments: [],
    });
    expect(write).toMatchObject({ ok: false, status: 403, code: "cannot_write_role" });
    const marked = await service.markReadForClient(member("viewer", "vic"), SUBMISSION);
    expect(marked).toEqual({ ok: true, value: { marked: 0 } });
    expect(messages.messages[0]?.readAt).toBeNull();
  });

  it("a restricted organisation keeps reading and cannot write", async () => {
    const { service } = setup({ status: "restricted" });
    const write = await service.writeForClient(member("owner"), SUBMISSION, {
      body: "Hello",
      attachments: [],
    });
    expect(write).toMatchObject({ ok: false, status: 403, code: "cannot_write_organisation" });
  });

  it("the consignor who sent it writes; the specialist hears and earlier replies count as read", async () => {
    const { service, messages, notifier } = setup();
    messages.seedMessage({
      submissionId: SUBMISSION,
      side: "staff",
      authorUserId: "clara",
      body: "Is the frame original?",
      at: new Date("2026-10-27T09:00:00Z"),
    });
    const result = await service.writeForClient(member("consignor", "lena"), SUBMISSION, {
      body: "  Yes, it is.\r\n\r\n\r\nPhoto attached. ",
      attachments: [],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      side: "client",
      author: { userId: "lena", name: "Lena Fischer" },
      body: "Yes, it is.\n\nPhoto attached.",
      createdAt: NOW.toISOString(),
    });
    expect(messages.messages[0]?.readAt).toEqual(NOW);
    expect(notifier.clientWrote).toHaveBeenCalledWith(
      expect.objectContaining({ authorName: "Lena Fischer", fileCount: 0 }),
    );
  });

  it("refuses an empty message and files that are not the author's checked uploads", async () => {
    const { service, messages } = setup();
    expect(
      await service.writeForClient(member("owner"), SUBMISSION, { body: " ", attachments: [] }),
    ).toMatchObject({ ok: false, status: 400, code: "message_empty" });
    messages.seedUpload({
      id: "u-pending",
      ownerUserId: "owner",
      kind: CONSIGNMENT_MESSAGE_UPLOAD_KIND,
      status: "uploaded",
      key: "a.jpg",
    });
    messages.seedUpload({
      id: "u-theirs",
      ownerUserId: "someone",
      kind: CONSIGNMENT_MESSAGE_UPLOAD_KIND,
      status: "active",
      key: "b.jpg",
    });
    messages.seedUpload({
      id: "u-avatar",
      ownerUserId: "owner",
      kind: "avatar",
      status: "active",
      key: "c.jpg",
    });
    const send = (uploadObjectId: string) =>
      service.writeForClient(member("owner"), SUBMISSION, {
        body: "",
        attachments: [{ uploadObjectId }],
      });
    expect(await send("u-pending")).toMatchObject({ code: "attachment_not_ready" });
    expect(await send("u-theirs")).toMatchObject({ code: "attachment_invalid" });
    expect(await send("u-avatar")).toMatchObject({ code: "attachment_invalid" });
    expect(await send("u-missing")).toMatchObject({ code: "attachment_invalid" });
    expect(messages.messages).toHaveLength(0);
  });

  it("sends a file alone, with a link and the name the device gave", async () => {
    const { service, messages } = setup();
    messages.seedUpload({
      id: "u1",
      ownerUserId: "owner",
      kind: CONSIGNMENT_MESSAGE_UPLOAD_KIND,
      status: "active",
      key: "uploads/frame.jpg",
    });
    const result = await service.writeForClient(member("owner"), SUBMISSION, {
      body: "",
      attachments: [{ uploadObjectId: "u1", fileName: "frame-label.jpg" }],
    });
    expect(result.ok && result.value.attachments).toEqual([
      {
        id: expect.any(String),
        fileName: "frame-label.jpg",
        contentType: "image/jpeg",
        byteSize: 1024,
        url: "/f/uploads/frame.jpg",
      },
    ]);
  });

  it("marks the specialist's messages read for the people who answer", async () => {
    const { service, messages } = setup();
    messages.seedMessage({
      submissionId: SUBMISSION,
      side: "staff",
      authorUserId: "clara",
      body: "Hello",
      at: NOW,
    });
    expect(await service.markReadForClient(member("admin"), SUBMISSION)).toEqual({
      ok: true,
      value: { marked: 1 },
    });
  });

  it("support staff viewing the account neither write nor clear the task", async () => {
    const { service, messages } = setup();
    messages.seedMessage({
      submissionId: SUBMISSION,
      side: "staff",
      authorUserId: "clara",
      body: "Hello",
      at: NOW,
    });
    const viewer = member("owner", "support", true);
    expect(
      await service.writeForClient(viewer, SUBMISSION, { body: "Hi", attachments: [] }),
    ).toMatchObject({ ok: false, status: 403, code: "cannot_write_read_only" });
    expect(await service.markReadForClient(viewer, SUBMISSION)).toEqual({
      ok: true,
      value: { marked: 0 },
    });
  });
});

describe("staff side", () => {
  it("replies and tells the account; the client's messages count as read", async () => {
    const { service, messages, notifier } = setup();
    messages.seedMessage({
      submissionId: SUBMISSION,
      side: "client",
      authorUserId: "lena",
      body: "Any news?",
      at: new Date("2026-10-28T09:00:00Z"),
    });
    const result = await service.writeForStaff("clara", SUBMISSION, {
      body: "The agreement is ready.",
      attachments: [],
    });
    expect(result.ok && result.value.side).toBe("staff");
    expect(messages.messages[0]?.readAt).toEqual(NOW);
    expect(notifier.specialistWrote).toHaveBeenCalledWith(
      expect.objectContaining({ authorName: "Clara Mendes", body: "The agreement is ready." }),
    );
  });

  it("reads one thread with whether it waits for LAX", async () => {
    const { service, messages } = setup();
    messages.seedMessage({
      submissionId: SUBMISSION,
      side: "client",
      authorUserId: "lena",
      body: "Any news?",
      at: NOW,
    });
    const result = await service.readForStaff(SUBMISSION);
    expect(result).toMatchObject({
      ok: true,
      value: {
        submission: { id: SUBMISSION, reference: "C-2041" },
        account: { id: ACCOUNT, name: "Northbank Gallery" },
        unread: 1,
        awaitingStaff: true,
      },
    });
    expect(await service.readForStaff("missing")).toMatchObject({ ok: false, status: 404 });
  });

  it("lists threads waiting for an answer, one specialist's, a page at a time", async () => {
    const { service, messages } = setup();
    messages.seedMessage({
      submissionId: SUBMISSION,
      side: "client",
      authorUserId: "lena",
      body: "Is there a date for the sale yet? ".repeat(10),
      at: NOW,
    });
    const page = await service.listForStaff("clara", {
      view: "unanswered",
      assigned: "me",
      limit: 1,
    });
    expect(page.rows).toHaveLength(1);
    expect(page.rows[0]).toMatchObject({
      reference: "C-2041",
      awaitingStaff: true,
      unread: 1,
    });
    expect(page.rows[0]?.lastMessagePreview.length).toBeLessThanOrEqual(160);
    expect(page.nextCursor).toBeNull();
    const unassigned = await service.listForStaff("clara", {
      view: "all",
      assigned: "unassigned",
      limit: 10,
    });
    expect(unassigned.rows).toHaveLength(0);
  });

  it("assigns through the submission's assignment and returns the specialist", async () => {
    const { service, assigner } = setup();
    const result = await service.assign("lead", SUBMISSION, "clara");
    expect(assigner.assign).toHaveBeenCalledWith({
      staffUserId: "lead",
      submissionId: SUBMISSION,
      assignedToUserId: "clara",
    });
    expect(result).toEqual({
      ok: true,
      value: { specialist: { userId: "clara", name: "Clara Mendes" } },
    });
  });

  it("passes on a refused assignment", async () => {
    const { service, assigner } = setup();
    assigner.assign.mockResolvedValueOnce({ ok: false, status: 400, message: "Not staff" });
    expect(await service.assign("lead", SUBMISSION, "nobody")).toMatchObject({
      ok: false,
      status: 400,
      error: "Not staff",
    });
  });
});

describe("inbox cursor", () => {
  it("round-trips and ignores rubbish", () => {
    const at = new Date("2026-10-29T10:00:00Z");
    const cursor = encodeThreadCursor({ lastMessageAt: at, submissionId: SUBMISSION });
    expect(decodeThreadCursor(cursor)).toEqual({ lastMessageAt: at, submissionId: SUBMISSION });
    expect(decodeThreadCursor("not-a-cursor")).toBeUndefined();
    expect(decodeThreadCursor(undefined)).toBeUndefined();
  });
});
