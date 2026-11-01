import type { LegalEntityMemberRole } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import { ConsignmentMessageHttpApplicationService } from "../services/consignment-messages/consignment-message-http-application.service.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { SUBMISSION_ID, consignmentThreadFixture } from "../testing/consignment-thread-fixture.js";
import { passThroughAccountOnboarding } from "../testing/pass-through-account-onboarding.middleware.js";
import { stubSubmissionRouteServices } from "../testing/stub-submission-route-services.js";
import { createSubmissionRoutes } from "./submissions.js";

const entityId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const otherEntityId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const submissionId = SUBMISSION_ID;

function mount(options: { role?: LegalEntityMemberRole; submissionEntityId?: string }) {
  const fixture = consignmentThreadFixture();
  const { messages, notifier } = fixture;
  messages.seedSubject({
    ...(messages.subjects.get(submissionId) ?? (undefined as never)),
    account: {
      id: options.submissionEntityId ?? entityId,
      name: "Northbank Gallery",
      kind: "organisation",
      status: "approved",
    },
  });
  messages.memberRoles.set("u1", "consignor");
  messages.names.set("u1", "Lena Fischer");
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
    submissionRoutes: stubSubmissionRouteServices({
      messageHttp: new ConsignmentMessageHttpApplicationService(
        fixture.client,
        fixture.commands,
        fixture.queries,
      ),
    }),
  } as unknown as Container;
  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn().mockResolvedValue({
      id: "u1",
      role: "client",
      scopes: ["bid.read", "bid.write"],
    }),
  };
  const app = new Hono();
  app.route(
    "/submissions",
    createSubmissionRoutes(container, authenticator, passThroughAccountOnboarding),
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
