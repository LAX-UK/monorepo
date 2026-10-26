import { verifyBearerToken } from "@auction/auth/token-verifier";
import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import { ENQUIRY_NOTE_MAX_LENGTH, SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import type { ShopStaffRole } from "@auction/shop-domain";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(),
}));

import { createShopApiApp } from "../../../app.js";
import { encodeEnquiryInboxCursor } from "../../../application/enquiry-inbox-cursor.js";
import { createEnquiryInboxService } from "../../../application/enquiry-inbox.service.js";
import type { EnquiryInboxRepository } from "../../../application/ports/enquiry-inbox.repository.js";
import { createMinimalShopApiTestDeps } from "../../../test-app-deps.js";
import { createStubEnquiryInboxRepository } from "../../../test-support/stub-enquiry-inbox-repository.js";

const ADMIN_TOKEN = "admin-token-placeholder-minimum-length";
const ENQUIRY_ID = "44444444-4444-4444-8444-444444444444";
const VERSION = "2026-03-01T10:00:00.123456Z";
const NEWER_VERSION = "2026-03-01T10:05:00.000001Z";

const ALL_ROLES: ShopStaffRole[] = [
  "shop_admin",
  "account_manager",
  "broker",
  "operations",
  "finance",
  "catalogue_editor",
];
const CAN_READ: ShopStaffRole[] = ["shop_admin", "account_manager", "broker", "operations"];
const CAN_WRITE: ShopStaffRole[] = ["shop_admin", "account_manager"];

const detail = {
  kind: "general" as const,
  id: ENQUIRY_ID,
  topic: "selling" as const,
  status: "new" as const,
  assignee: null,
  sender: { type: "guest" as const, name: "Ada", email: "ada@example.com", phone: null },
  artwork: null,
  contextSlug: null,
  message: "I would like to sell a painting.",
  notes: [],
  createdAt: "2026-03-01T10:00:00.000Z",
  closedAt: null,
  version: VERSION,
};

/** Staff the assignee check can find: an account manager and a catalogue editor. */
const ACTIVE_STAFF: Record<string, ShopStaffRole> = {
  "colleague-subject": "account_manager",
  "editor-subject": "catalogue_editor",
};

async function buildApp(role: ShopStaffRole, repository: Partial<EnquiryInboxRepository> = {}) {
  vi.mocked(verifyBearerToken).mockResolvedValue({
    subject: `${role}-subject`,
    payload: {
      scope: "shop.admin",
      acr: OIDC_ACR_SILVER,
      auth_time: Math.floor(Date.now() / 1000),
    },
  } as never);
  const staffReader = {
    findActiveByIdentitySubject: async (subject: string) => {
      if (subject === `${role}-subject`) return { role, identitySubjectId: subject };
      const colleague = ACTIVE_STAFF[subject];
      return colleague ? { role: colleague, identitySubjectId: subject } : null;
    },
    brokerCanAccessClientParty: async () => false,
  };
  const deps = createMinimalShopApiTestDeps({
    env: { ...createMinimalShopApiTestDeps().env, SHOP_ADMIN_ENABLED: true },
    staffReader,
  });
  deps.admin.enquiryInbox = createEnquiryInboxService({
    repository: createStubEnquiryInboxRepository({
      getDetail: async () => detail,
      update: async () => ({ status: "updated", version: NEWER_VERSION }),
      addNote: async (input) => ({
        id: "55555555-5555-4555-8555-555555555555",
        author: { subject: input.authorSubjectId, label: null, role: "account_manager" },
        body: input.body,
        createdAt: "2026-03-01T11:00:00.000Z",
      }),
      ...repository,
    }),
    staffReader,
  });
  const app = createShopApiApp({ deps, logger: false });
  await app.ready();
  return app;
}

const auth = { authorization: `Bearer ${ADMIN_TOKEN}` };

describe("enquiry inbox capabilities", () => {
  const probes = [
    { name: "list", method: "GET", url: "/admin/v1/enquiries", allowed: CAN_READ },
    { name: "summary", method: "GET", url: "/admin/v1/enquiries/summary", allowed: CAN_READ },
    { name: "assignees", method: "GET", url: "/admin/v1/enquiries/assignees", allowed: CAN_READ },
    {
      name: "detail",
      method: "GET",
      url: `/admin/v1/enquiries/general/${ENQUIRY_ID}`,
      allowed: CAN_READ,
    },
    {
      name: "update",
      method: "PATCH",
      url: `/admin/v1/enquiries/general/${ENQUIRY_ID}`,
      payload: { status: "closed", expectedVersion: VERSION },
      allowed: CAN_WRITE,
    },
    {
      name: "add note",
      method: "POST",
      url: `/admin/v1/enquiries/general/${ENQUIRY_ID}/notes`,
      payload: { body: "Called back" },
      allowed: CAN_WRITE,
    },
  ] as const;
  const cases = probes.flatMap((probe) =>
    ALL_ROLES.map((role) => ({ probe, role, allowed: probe.allowed.includes(role) })),
  );

  it.each(cases)("$probe.name as $role is allowed: $allowed", async ({ probe, role, allowed }) => {
    const app = await buildApp(role);
    const response = await app.inject({
      method: probe.method,
      url: probe.url,
      headers: auth,
      ...("payload" in probe ? { payload: probe.payload } : {}),
    });
    if (allowed) {
      expect(response.statusCode).toBeLessThan(300);
    } else {
      expect(response.statusCode).toBe(403);
    }
    await app.close();
  });
});

describe("enquiry inbox list", () => {
  it("passes filters through and resolves `me` to the signed-in member of staff", async () => {
    const list = vi.fn(createStubEnquiryInboxRepository().list);
    const app = await buildApp("account_manager", { list });
    const response = await app.inject({
      method: "GET",
      url: "/admin/v1/enquiries?kind=artwork&topic=artwork&status=in_progress&assignee=me&q=%20ada%20&limit=10",
      headers: auth,
    });
    expect(response.statusCode).toBe(200);
    expect(list).toHaveBeenCalledWith({
      filters: {
        kind: "artwork",
        topic: "artwork",
        status: "in_progress",
        assignee: { type: "subject", subject: "account_manager-subject" },
        q: "ada",
      },
      cursor: null,
      limit: 10,
      sort: "received_desc",
    });
    await app.close();
  });

  it("lists newest first by default and oldest first on request", async () => {
    const list = vi.fn(createStubEnquiryInboxRepository().list);
    const app = await buildApp("broker", { list });
    await app.inject({ method: "GET", url: "/admin/v1/enquiries", headers: auth });
    await app.inject({
      method: "GET",
      url: "/admin/v1/enquiries?sort=received_asc",
      headers: auth,
    });
    const rejected = await app.inject({
      method: "GET",
      url: "/admin/v1/enquiries?sort=sender",
      headers: auth,
    });
    expect(list.mock.calls[0]?.[0]).toMatchObject({ sort: "received_desc", limit: 50 });
    expect(list.mock.calls[1]?.[0]).toMatchObject({ sort: "received_asc" });
    expect(rejected.statusCode).toBe(400);
    await app.close();
  });

  it("maps `unassigned` and a named colleague", async () => {
    const list = vi.fn(createStubEnquiryInboxRepository().list);
    const app = await buildApp("broker", { list });
    await app.inject({
      method: "GET",
      url: "/admin/v1/enquiries?assignee=unassigned",
      headers: auth,
    });
    await app.inject({
      method: "GET",
      url: "/admin/v1/enquiries?assignee=colleague-subject",
      headers: auth,
    });
    expect(list.mock.calls[0]?.[0].filters.assignee).toEqual({ type: "unassigned" });
    expect(list.mock.calls[1]?.[0].filters.assignee).toEqual({
      type: "subject",
      subject: "colleague-subject",
    });
    await app.close();
  });

  it("encodes the next cursor from the repository position", async () => {
    const position = {
      waiting: true,
      createdAt: VERSION,
      kind: "artwork" as const,
      id: ENQUIRY_ID,
    };
    const app = await buildApp("operations", {
      list: async () => ({
        items: [],
        nextCursor: position,
        counts: { new: 1, in_progress: 0, closed: 0 },
      }),
    });
    const response = await app.inject({ method: "GET", url: "/admin/v1/enquiries", headers: auth });
    expect(response.json()).toMatchObject({
      nextCursor: encodeEnquiryInboxCursor(position),
      counts: { new: 1, in_progress: 0, closed: 0 },
    });
    await app.close();
  });

  it.each([
    ["an unknown kind", "kind=order"],
    ["an unknown status", "status=archived"],
    ["a search over 100 characters", `q=${"x".repeat(101)}`],
    ["a malformed cursor", "cursor=not-a-cursor"],
  ])("rejects %s", async (_name, query) => {
    const app = await buildApp("shop_admin");
    const response = await app.inject({
      method: "GET",
      url: `/admin/v1/enquiries?${query}`,
      headers: auth,
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });
});

describe("enquiry detail", () => {
  it("answers 404 for an enquiry that does not exist", async () => {
    const app = await buildApp("shop_admin", { getDetail: async () => null });
    const response = await app.inject({
      method: "GET",
      url: `/admin/v1/enquiries/artwork/${ENQUIRY_ID}`,
      headers: auth,
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("rejects an unknown kind or a non-uuid id", async () => {
    const app = await buildApp("shop_admin");
    const kind = await app.inject({
      method: "GET",
      url: `/admin/v1/enquiries/order/${ENQUIRY_ID}`,
      headers: auth,
    });
    expect(kind.statusCode).toBe(400);
    await app.close();
  });
});

describe("enquiry update", () => {
  const url = `/admin/v1/enquiries/general/${ENQUIRY_ID}`;

  it("answers 409 with the current version when the enquiry changed", async () => {
    const app = await buildApp("account_manager", {
      update: async () => ({ status: "stale", currentVersion: NEWER_VERSION }),
    });
    const response = await app.inject({
      method: "PATCH",
      url,
      headers: auth,
      payload: { status: "closed", expectedVersion: VERSION },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: SHOP_API_ERROR_CODES.CONFLICT,
      currentVersion: NEWER_VERSION,
    });
    await app.close();
  });

  it("requires an expected version and something to change", async () => {
    const app = await buildApp("account_manager");
    const noVersion = await app.inject({
      method: "PATCH",
      url,
      headers: auth,
      payload: { status: "closed" },
    });
    const nothing = await app.inject({
      method: "PATCH",
      url,
      headers: auth,
      payload: { expectedVersion: VERSION },
    });
    expect(noVersion.statusCode).toBe(400);
    expect(nothing.statusCode).toBe(400);
    await app.close();
  });

  it("answers 404 for an enquiry that does not exist", async () => {
    const app = await buildApp("account_manager", {
      update: async () => ({ status: "not_found" }),
    });
    const response = await app.inject({
      method: "PATCH",
      url,
      headers: auth,
      payload: { status: "closed", expectedVersion: VERSION },
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("assigns an active colleague who can handle enquiries", async () => {
    const update = vi.fn(async () => ({ status: "updated" as const, version: NEWER_VERSION }));
    const app = await buildApp("account_manager", { update });
    const response = await app.inject({
      method: "PATCH",
      url,
      headers: auth,
      payload: { assigneeSubject: "colleague-subject", expectedVersion: VERSION },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ version: NEWER_VERSION });
    expect(update).toHaveBeenCalledWith({
      kind: "general",
      id: ENQUIRY_ID,
      expectedVersion: VERSION,
      assigneeSubject: "colleague-subject",
      actorSubjectId: "account_manager-subject",
    });
    await app.close();
  });

  it.each([
    ["an unknown subject", "ghost-subject"],
    ["staff whose role cannot handle enquiries", "editor-subject"],
  ])("refuses to assign %s", async (_name, assigneeSubject) => {
    const update = vi.fn();
    const app = await buildApp("account_manager", { update });
    const response = await app.inject({
      method: "PATCH",
      url,
      headers: auth,
      payload: { assigneeSubject, expectedVersion: VERSION },
    });
    expect(response.statusCode).toBe(400);
    expect(update).not.toHaveBeenCalled();
    await app.close();
  });

  it("unassigns with null without looking anyone up", async () => {
    const update = vi.fn(async () => ({ status: "updated" as const, version: NEWER_VERSION }));
    const app = await buildApp("account_manager", { update });
    const response = await app.inject({
      method: "PATCH",
      url,
      headers: auth,
      payload: { assigneeSubject: null, expectedVersion: VERSION },
    });
    expect(response.statusCode).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ assigneeSubject: null }));
    await app.close();
  });
});

describe("enquiry notes", () => {
  const url = `/admin/v1/enquiries/artwork/${ENQUIRY_ID}/notes`;

  it("stores a trimmed note under the signed-in author", async () => {
    const addNote = vi.fn(createStubEnquiryInboxRepository().addNote);
    const app = await buildApp("account_manager", {
      addNote: async (input) => {
        await addNote(input);
        return {
          id: "55555555-5555-4555-8555-555555555555",
          author: { subject: input.authorSubjectId, label: null, role: "account_manager" },
          body: input.body,
          createdAt: "2026-03-01T11:00:00.000Z",
        };
      },
    });
    const response = await app.inject({
      method: "POST",
      url,
      headers: auth,
      payload: { body: "  Rang the collector  " },
    });
    expect(response.statusCode).toBe(201);
    expect(addNote).toHaveBeenCalledWith({
      kind: "artwork",
      id: ENQUIRY_ID,
      body: "Rang the collector",
      authorSubjectId: "account_manager-subject",
    });
    await app.close();
  });

  it("accepts a note of exactly the maximum length", async () => {
    const app = await buildApp("account_manager");
    const response = await app.inject({
      method: "POST",
      url,
      headers: auth,
      payload: { body: "é".repeat(ENQUIRY_NOTE_MAX_LENGTH) },
    });
    expect(response.statusCode).toBe(201);
    await app.close();
  });

  it.each([
    ["longer than the maximum", "x".repeat(ENQUIRY_NOTE_MAX_LENGTH + 1)],
    ["empty", ""],
    ["only whitespace", "   \n "],
  ])("rejects a note that is %s", async (_name, body) => {
    const app = await buildApp("account_manager");
    const response = await app.inject({ method: "POST", url, headers: auth, payload: { body } });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it("answers 404 for an enquiry that does not exist", async () => {
    const app = await buildApp("account_manager", { addNote: async () => null });
    const response = await app.inject({
      method: "POST",
      url,
      headers: auth,
      payload: { body: "Hello" },
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });
});
