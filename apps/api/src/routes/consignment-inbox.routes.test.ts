import { normalizeStaffRoles } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import {
  ConsignmentMessageHttpApplicationService,
  ConsignmentSavedReplyHttpApplicationService,
} from "../services/consignment-messages/consignment-message-http-application.service.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import {
  OTHER_SUBMISSION_ID,
  SUBMISSION_ID,
  consignmentThreadFixture,
} from "../testing/consignment-thread-fixture.js";
import { stubSubmissionRouteServices } from "../testing/stub-submission-route-services.js";
import { createAdminConsignmentSavedReplyRoutes } from "./admin-consignment-saved-replies.js";
import { createAdminConsignmentThreadRoutes } from "./admin-consignment-threads.js";

const MESSAGE_ID = "55555555-5555-4555-8555-555555555555";

function mount(staffRole: string | null) {
  const fixture = consignmentThreadFixture();
  fixture.messages.seedMessage({
    submissionId: SUBMISSION_ID,
    side: "client",
    authorUserId: "lena",
    body: "Any news?",
    at: new Date("2026-10-28T10:00:00Z"),
  });
  const container = {
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    submissionRoutes: stubSubmissionRouteServices({
      messageHttp: new ConsignmentMessageHttpApplicationService(
        fixture.client,
        fixture.commands,
        fixture.queries,
      ),
      savedReplyHttp: new ConsignmentSavedReplyHttpApplicationService(fixture.savedReplyService),
    }),
  } as unknown as Container;
  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn().mockResolvedValue({
      id: "clara",
      role: staffRole === null ? "client" : "staff",
      ...(staffRole === null ? {} : { staffRoles: normalizeStaffRoles([staffRole]) }),
      scopes: ["bid.read", "bid.write"],
    }),
  };
  const app = new Hono();
  app.route(
    "/admin/consignment-threads",
    createAdminConsignmentThreadRoutes(container, authenticator),
  );
  app.route(
    "/admin/consignment-saved-replies",
    createAdminConsignmentSavedReplyRoutes(container, authenticator),
  );
  const call = (method: string, path: string, body?: unknown) =>
    app.request(`http://t${path}`, {
      method,
      ...(body === undefined
        ? {}
        : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    });
  return { call, fixture };
}

const threads = "/admin/consignment-threads";
const thread = `${threads}/${SUBMISSION_ID}`;

const READS: Array<[string, string]> = [
  ["GET", threads],
  ["GET", `${threads}/summary`],
  ["GET", `${threads}/assignees`],
  ["GET", thread],
  ["GET", "/admin/consignment-saved-replies"],
];

const WRITES: Array<[string, string, unknown]> = [
  ["POST", `${thread}/messages`, { body: "Hello" }],
  ["DELETE", `${thread}/messages/${MESSAGE_ID}`, undefined],
  ["POST", `${thread}/close`, {}],
  ["POST", `${thread}/reopen`, {}],
  ["POST", `${thread}/read`, {}],
  ["POST", `${thread}/unread`, {}],
  ["POST", `${thread}/assign`, { assignedToUserId: null }],
  ["POST", `${threads}/bulk`, { action: "mark_read", submissionIds: [SUBMISSION_ID] }],
];

const MANAGE: Array<[string, string, unknown]> = [
  ["POST", "/admin/consignment-saved-replies", { title: "Welcome", body: "Hi" }],
  ["PATCH", `/admin/consignment-saved-replies/${MESSAGE_ID}`, { title: "Welcome", body: "Hi" }],
  ["DELETE", `/admin/consignment-saved-replies/${MESSAGE_ID}`, undefined],
];

describe("permissions", () => {
  const repliers = ["specialist", "client_services", "sales_manager", "administrator"];
  const readers = ["cataloguer", "finance", "compliance", "fulfilment", "read_only"];

  it.each([...repliers, ...readers])("%s can read the inbox", async (role) => {
    const { call } = mount(role);
    for (const [method, path] of READS) {
      expect((await call(method, path)).status, `${method} ${path}`).toBe(200);
    }
  });

  it.each(repliers)("%s can reply and change threads", async (role) => {
    const { call } = mount(role);
    for (const [method, path, body] of WRITES) {
      const status = (await call(method, path, body)).status;
      expect(status, `${method} ${path}`).not.toBe(403);
    }
  });

  it.each(readers)("%s reads along but changes nothing", async (role) => {
    const { call, fixture } = mount(role);
    for (const [method, path, body] of [...WRITES, ...MANAGE]) {
      expect((await call(method, path, body)).status, `${method} ${path}`).toBe(403);
    }
    expect(fixture.messages.messages.every((m) => m.readAt === null)).toBe(true);
    expect(fixture.messages.messages).toHaveLength(1);
  });

  it("the saleroom clerk sees and changes nothing", async () => {
    const { call } = mount("saleroom_clerk");
    for (const [method, path, body] of [
      ...READS.map(([m, p]) => [m, p, undefined] as const),
      ...WRITES,
      ...MANAGE,
    ]) {
      expect((await call(method, path, body)).status, `${method} ${path}`).toBe(403);
    }
  });

  it("only sales managers and administrators write saved replies", async () => {
    for (const role of ["sales_manager", "administrator"]) {
      const { call } = mount(role);
      expect((await call("POST", MANAGE[0]?.[1] ?? "", MANAGE[0]?.[2])).status).toBe(201);
    }
    for (const role of ["specialist", "client_services"]) {
      const { call } = mount(role);
      for (const [method, path, body] of MANAGE) {
        expect((await call(method, path, body)).status, `${role} ${method}`).toBe(403);
      }
    }
  });

  it("clients get nothing", async () => {
    const { call } = mount(null);
    expect((await call("GET", threads)).status).toBe(403);
    expect((await call("GET", "/admin/consignment-saved-replies")).status).toBe(403);
  });
});

describe("the thread endpoints", () => {
  it("lists, summarises, opens a thread and replies with a held message", async () => {
    const { call } = mount("specialist");
    const list = await call("GET", `${threads}?view=unanswered`);
    const listed = (await list.json()) as {
      data: { submissionId: string }[];
      view: string;
      sort: string;
    };
    expect(listed).toMatchObject({ view: "unanswered", sort: "waiting" });
    expect(listed.data.map((row) => row.submissionId)).toEqual([SUBMISSION_ID]);

    const summary = (await (await call("GET", `${threads}/summary`)).json()) as {
      data: { unanswered: number; mine: { waiting: number } };
    };
    expect(summary.data).toMatchObject({ unanswered: 1, mine: { waiting: 1 } });

    const detail = (await (await call("GET", thread)).json()) as {
      data: { lastMessageId: string; abilities: { canReply: boolean } };
    };
    expect(detail.data.abilities.canReply).toBe(true);

    const reply = await call("POST", `${thread}/messages`, {
      body: "Next week.",
      lastSeenMessageId: detail.data.lastMessageId,
    });
    expect(reply.status).toBe(201);
    const sent = (await reply.json()) as { data: { id: string; undoUntil: string } };
    expect(sent.data.undoUntil).toEqual(expect.any(String));

    const undone = await call("DELETE", `${thread}/messages/${sent.data.id}`);
    expect(undone.status).toBe(200);
  });

  it("answers 409 with the new messages when the client wrote while the reply was being typed", async () => {
    const { call, fixture } = mount("specialist");
    const seen = fixture.messages.messages[0]?.id ?? "";
    fixture.messages.seedMessage({
      submissionId: SUBMISSION_ID,
      side: "client",
      authorUserId: "lena",
      body: "One more thing",
      at: new Date("2026-10-28T11:00:00Z"),
    });
    const res = await call("POST", `${thread}/messages`, { body: "Hi", lastSeenMessageId: seen });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      code: "thread_changed",
      newMessages: [{ body: "One more thing" }],
    });
  });

  it("answers 409 undo_expired once the reply has gone to the client", async () => {
    const { call, fixture } = mount("specialist");
    fixture.messages.seedMessage({
      submissionId: SUBMISSION_ID,
      side: "staff",
      authorUserId: "clara",
      body: "Gone",
      at: new Date("2026-10-28T12:00:00Z"),
      deliverAfter: new Date("2026-10-28T12:00:10Z"),
    });
    const id = fixture.messages.messages.at(-1)?.id ?? "";
    const res = await call("DELETE", `${thread}/messages/${id}`);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "undo_expired" });
  });

  it("answers 404 for an unknown consignment on every id-keyed endpoint", async () => {
    const { call } = mount("administrator");
    const unknown = `${threads}/${OTHER_SUBMISSION_ID}`;
    for (const [method, path, body] of [
      ["GET", unknown, undefined],
      ["POST", `${unknown}/messages`, { body: "Hi" }],
      ["DELETE", `${unknown}/messages/${MESSAGE_ID}`, undefined],
      ["POST", `${unknown}/close`, {}],
      ["POST", `${unknown}/reopen`, {}],
      ["POST", `${unknown}/read`, {}],
      ["POST", `${unknown}/unread`, {}],
      ["POST", `${unknown}/assign`, { assignedToUserId: null }],
    ] as const) {
      expect((await call(method, path, body)).status, `${method} ${path}`).toBe(404);
    }
  });

  it("closes, reopens and assigns", async () => {
    const { call } = mount("specialist");
    expect(await (await call("POST", `${thread}/close`, {})).json()).toEqual({
      data: { changed: true },
    });
    expect(await (await call("POST", `${thread}/reopen`, {})).json()).toEqual({
      data: { changed: true },
    });
    const assigned = await call("POST", `${thread}/assign`, {
      assignedToUserId: "omar",
      covering: true,
    });
    expect(await assigned.json()).toMatchObject({
      data: { changed: true, assignee: { userId: "omar", covering: true } },
    });
    const refused = await call("POST", `${thread}/assign`, { assignedToUserId: "finn" });
    expect(refused.status).toBe(400);
  });

  it("runs a bulk action and rejects a body that names both threads and a filter", async () => {
    const { call } = mount("specialist");
    const done = await call("POST", `${threads}/bulk`, {
      action: "close",
      filter: { view: "unanswered" },
    });
    expect(await done.json()).toEqual({ data: { changed: 1, skipped: 0 } });
    const both = await call("POST", `${threads}/bulk`, {
      action: "close",
      submissionIds: [SUBMISSION_ID],
      filter: { view: "all" },
    });
    expect(both.status).toBe(400);
  });

  it("reads the fixed paths before a consignment id", async () => {
    const { call } = mount("specialist");
    expect((await call("GET", `${threads}/summary`)).status).toBe(200);
    expect((await call("GET", `${threads}/assignees`)).status).toBe(200);
  });
});

describe("the saved replies endpoints", () => {
  it("lists, creates, edits and removes", async () => {
    const { call } = mount("sales_manager");
    const created = await call("POST", "/admin/consignment-saved-replies", {
      title: "Welcome",
      body: "Hi {client first name}",
    });
    expect(created.status).toBe(201);
    const { data } = (await created.json()) as { data: { id: string } };
    expect(
      (
        await call("PATCH", `/admin/consignment-saved-replies/${data.id}`, {
          title: "Hello",
          body: "Hi",
        })
      ).status,
    ).toBe(200);
    const list = (await (await call("GET", "/admin/consignment-saved-replies")).json()) as {
      data: { title: string }[];
    };
    expect(list.data.map((r) => r.title)).toEqual(["Hello"]);
    expect((await call("DELETE", `/admin/consignment-saved-replies/${data.id}`)).status).toBe(200);
  });

  it("answers 409 for a title already used", async () => {
    const { call } = mount("administrator");
    const body = { title: "Welcome", body: "Hi" };
    await call("POST", "/admin/consignment-saved-replies", body);
    const again = await call("POST", "/admin/consignment-saved-replies", body);
    expect(again.status).toBe(409);
  });

  it("answers 400 saved_reply_limit at the limit", async () => {
    const { call } = mount("administrator");
    for (let i = 0; i < 25; i++) {
      await call("POST", "/admin/consignment-saved-replies", { title: `Reply ${i}`, body: "x" });
    }
    const res = await call("POST", "/admin/consignment-saved-replies", {
      title: "More",
      body: "x",
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "saved_reply_limit" });
  });
});
