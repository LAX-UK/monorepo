import { type LegalEntityMemberRole, normalizeStaffRoles } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import { ConsignmentMessageHttpApplicationService } from "../services/consignment-messages/consignment-message-http-application.service.js";
import { ConsignmentMessageService } from "../services/consignment-messages/consignment-message.service.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { InMemoryConsignmentMessages } from "../testing/in-memory-consignment-messages.js";
import { passThroughAccountOnboarding } from "../testing/pass-through-account-onboarding.middleware.js";
import { stubSubmissionRouteServices } from "../testing/stub-submission-route-services.js";
import { createAdminConsignmentThreadRoutes } from "./admin-consignment-threads.js";
import { createSubmissionRoutes } from "./submissions.js";

const entityId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const otherEntityId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const submissionId = "33333333-3333-4333-8333-333333333333";

function mount(options: {
  role?: LegalEntityMemberRole;
  submissionEntityId?: string;
  staffRole?: string;
}) {
  const messages = new InMemoryConsignmentMessages();
  messages.seedSubject({
    submissionId,
    title: "Thames at low tide",
    referenceNumber: 2041,
    submittedByUserId: "u1",
    account: {
      id: options.submissionEntityId ?? entityId,
      name: "Northbank Gallery",
      kind: "organisation",
      status: "approved",
    },
    specialist: { userId: "clara", name: "Clara Mendes" },
    saleId: null,
  });
  messages.names.set("clara", "Clara Mendes");
  messages.names.set("u1", "Lena Fischer");
  const notifier = { specialistWrote: vi.fn(), clientWrote: vi.fn() };
  const messageHttp = new ConsignmentMessageHttpApplicationService(
    new ConsignmentMessageService({
      messages,
      notifier,
      assigner: { assign: vi.fn().mockResolvedValue({ ok: true }) },
      links: { linksFor: async (keys) => [...keys] },
      now: () => new Date("2026-10-29T10:00:00Z"),
    }),
  );
  const container = {
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    requireSubmissionsLegalEntityContext: vi.fn((c, next) => {
      c.set("legalEntityContext", {
        legalEntityId: entityId,
        userId: "u1",
        role: options.role ?? "owner",
      });
      return next();
    }),
    submissionRoutes: stubSubmissionRouteServices({ messageHttp }),
  } as unknown as Container;
  const staff = options.staffRole !== undefined;
  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn().mockResolvedValue({
      id: staff ? "clara" : "u1",
      role: staff ? "staff" : "client",
      ...(staff ? { staffRoles: normalizeStaffRoles([options.staffRole]) } : {}),
      scopes: ["bid.read", "bid.write"],
    }),
  };
  const app = new Hono();
  app.route(
    "/submissions",
    createSubmissionRoutes(container, authenticator, passThroughAccountOnboarding),
  );
  app.route(
    "/admin/consignment-threads",
    createAdminConsignmentThreadRoutes(container, authenticator),
  );
  const post = (path: string, body: unknown) =>
    app.request(`http://t${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  return { app, post, messages, notifier };
}

describe("client consignment messages", () => {
  it("an owner writes, then reads the thread back", async () => {
    const { app, post, notifier } = mount({});
    const sent = await post(`/submissions/${submissionId}/messages`, { body: "Is there a date?" });
    expect(sent.status).toBe(201);
    expect(notifier.clientWrote).toHaveBeenCalledOnce();
    const res = await app.request(`http://t/submissions/${submissionId}/messages`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { messages: { body: string }[]; specialist: { name: string } };
    };
    expect(body.data.specialist.name).toBe("Clara Mendes");
    expect(body.data.messages.map((m) => m.body)).toEqual(["Is there a date?"]);
  });

  it("a viewer reads and is turned away from writing with the reason", async () => {
    const { app, post } = mount({ role: "viewer" });
    expect((await app.request(`http://t/submissions/${submissionId}/messages`)).status).toBe(200);
    const res = await post(`/submissions/${submissionId}/messages`, { body: "Hi" });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { message: string };
    expect(body.message).toMatch(/Your role can read these messages/);
  });

  it("another account's consignment is not found, for reading, writing and marking read", async () => {
    const { app, post } = mount({ submissionEntityId: otherEntityId });
    expect((await app.request(`http://t/submissions/${submissionId}/messages`)).status).toBe(404);
    expect((await post(`/submissions/${submissionId}/messages`, { body: "Hi" })).status).toBe(404);
    expect((await post(`/submissions/${submissionId}/messages/read`, {})).status).toBe(404);
  });

  it("rejects an empty message and an unknown field", async () => {
    const { post } = mount({});
    const empty = await post(`/submissions/${submissionId}/messages`, { body: "  " });
    expect(empty.status).toBe(400);
    expect(((await empty.json()) as { code: string }).code).toBe("message_empty");
    const extra = await post(`/submissions/${submissionId}/messages`, { body: "x", html: "<b>" });
    expect(extra.status).toBe(400);
  });
});

describe("staff consignment threads", () => {
  it("a specialist lists threads waiting for an answer and replies", async () => {
    const { app, post, messages, notifier } = mount({ staffRole: "specialist" });
    messages.seedMessage({
      submissionId,
      side: "client",
      authorUserId: "u1",
      body: "Any news?",
      at: new Date("2026-10-28T10:00:00Z"),
    });
    const list = await app.request(
      "http://t/admin/consignment-threads?view=unanswered&assigned=me",
    );
    expect(list.status).toBe(200);
    const body = (await list.json()) as { data: { submissionId: string }[]; nextCursor: null };
    expect(body.data.map((row) => row.submissionId)).toEqual([submissionId]);
    const reply = await post(`/admin/consignment-threads/${submissionId}/messages`, {
      body: "Next week.",
    });
    expect(reply.status).toBe(201);
    expect(notifier.specialistWrote).toHaveBeenCalledOnce();
    const read = await post(`/admin/consignment-threads/${submissionId}/read`, {});
    expect(read.status).toBe(200);
  });

  it("read-only staff can read threads but not reply, assign or mark read", async () => {
    const { app, post } = mount({ staffRole: "read_only" });
    expect((await app.request("http://t/admin/consignment-threads")).status).toBe(200);
    expect((await app.request(`http://t/admin/consignment-threads/${submissionId}`)).status).toBe(
      200,
    );
    expect(
      (await post(`/admin/consignment-threads/${submissionId}/messages`, { body: "x" })).status,
    ).toBe(403);
    expect(
      (await post(`/admin/consignment-threads/${submissionId}/assign`, { assignedToUserId: null }))
        .status,
    ).toBe(403);
    expect((await post(`/admin/consignment-threads/${submissionId}/read`, {})).status).toBe(403);
  });

  it("finance staff cannot open the inbox", async () => {
    const { app } = mount({ staffRole: "finance" });
    expect((await app.request("http://t/admin/consignment-threads")).status).toBe(403);
  });

  it("clients cannot open the inbox", async () => {
    const { app } = mount({});
    expect((await app.request("http://t/admin/consignment-threads")).status).toBe(403);
  });
});
