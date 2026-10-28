import { DrizzleLegalEntityLifecycleAdminRepository } from "@auction/persistence/repositories";
import type { StaffRoles } from "@auction/types";
import * as AuctionTypes from "@auction/types";
import { Hono } from "hono";
import { err } from "neverthrow";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import { createRequireCapability } from "../middleware/require-capability.js";
import { AdminLegalEntityLifecycleApplicationService } from "../services/admin/admin-legal-entity-lifecycle-application.service.js";
import { LegalEntityLifecycleAdminService } from "../services/legal-entity-lifecycle-admin.service.js";
import { mockDomainEventSink } from "../test/domain-event-sink-mock.js";
import { transactionRunnerFromDb } from "../test/transaction-runner-from-db.js";
import { createTestStaffGuards } from "../testing/staff-mutation-guards.js";
import { attachAdminLegalEntityLifecycleRoutes } from "./admin-legal-entity-lifecycle.js";

const ENTITY_ID = "00000000-0000-4000-8000-000000000001";
const ADMIN_ID = "00000000-0000-4000-8000-0000000000a1";

function minimalContainer(partial: Record<string, unknown>): Container {
  return {
    redis: { get: vi.fn().mockResolvedValue(null), set: vi.fn(), ping: vi.fn() },
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    legalEntityRepository: { findById: vi.fn().mockResolvedValue(null) },
    ...partial,
  } as unknown as Container;
}

function lifecycleApp(
  container: Container,
  userId: string,
  role: string,
  staffRoles?: StaffRoles | undefined,
  recentSignIn = true,
) {
  const requirePlatformAdmin = createRequireCapability("platform.admin.full");
  const app = new Hono<{
    Variables: {
      userId?: string;
      userRole?: string;
      userStaffRoles?: StaffRoles | undefined;
      identitySessionId?: string;
    };
  }>();
  const resolvedStaff: StaffRoles = role === "client" ? [] : (staffRoles ?? ["administrator"]);
  app.use("*", async (c, next) => {
    c.set("userId", userId);
    c.set("userRole", role);
    c.set("userStaffRoles", resolvedStaff);
    c.set("identitySessionId", "session-1");
    await next();
  });
  app.use("*", requirePlatformAdmin);
  const legalEntityLifecycle = new AdminLegalEntityLifecycleApplicationService(
    container.legalEntityRepository,
    container.legalEntityLifecycleAdminService,
    {
      listDocuments: vi.fn().mockResolvedValue([]),
      reviewDocument: vi.fn(),
    } as never,
  );
  attachAdminLegalEntityLifecycleRoutes(
    app,
    legalEntityLifecycle,
    createTestStaffGuards({ recent: recentSignIn }),
  );
  return app;
}

function denyCapabilityForSuperAdmin(deny: AuctionTypes.RoleCapability) {
  vi.spyOn(AuctionTypes, "roleHasCapability").mockImplementation((role, capability, staff) => {
    if (role !== "staff" || !staff?.includes("administrator")) {
      return AuctionTypes.roleHasCapability(role, capability, staff);
    }
    if (capability === "platform.admin.full") return true;
    if (capability === deny) return false;
    return true;
  });
}

/** Real service + mocked Drizzle tx so HTTP layer asserts concrete `event_type` values. */
function buildAppWithRealLifecycleService(
  entityStatus: string,
  rowExtras: Record<string, unknown> = {},
  recentSignIn = true,
) {
  return buildAppWithRealLifecycleServiceStatusPair(
    entityStatus,
    entityStatus,
    rowExtras,
    recentSignIn,
  );
}

/** Outer read vs `FOR UPDATE` read disagree — exercises row-lock concurrent_modification guard. */
function buildAppWithRealLifecycleServiceStatusPair(
  outerStatus: string,
  lockedRowStatus: string,
  rowExtras: Record<string, unknown> = {},
  recentSignIn = true,
) {
  const legalEntityRepository = {
    findById: vi.fn().mockResolvedValue({
      id: ENTITY_ID,
      displayName: "Test Entity Ltd",
    }),
  };
  const txHandle = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          for: vi.fn().mockReturnValue({
            limit: vi
              .fn()
              .mockResolvedValue([{ id: ENTITY_ID, status: lockedRowStatus, ...rowExtras }]),
          }),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  };
  const publish = vi.fn().mockResolvedValue(undefined);
  const db = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: ENTITY_ID, status: outerStatus, ...rowExtras }]),
        }),
      }),
    }),
    transaction: vi.fn(async (fn: (tx: typeof txHandle) => Promise<unknown>) => fn(txHandle)),
  };
  const service = new LegalEntityLifecycleAdminService(
    transactionRunnerFromDb(db as never),
    new DrizzleLegalEntityLifecycleAdminRepository(db as never),
    mockDomainEventSink(publish) as never,
  );
  const app = lifecycleApp(
    minimalContainer({ legalEntityLifecycleAdminService: service, legalEntityRepository }),
    ADMIN_ID,
    "staff",
    undefined,
    recentSignIn,
  );
  return { app, publish };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /admin/legal-entities/:id/request-docs (legal_entity.write)", () => {
  const path = `/legal-entities/${ENTITY_ID}/request-docs`;

  it("returns 403 for client (non-platform-admin)", async () => {
    const runTransition = vi.fn();
    const app = lifecycleApp(
      minimalContainer({ legalEntityLifecycleAdminService: { runTransition } }),
      ADMIN_ID,
      "client",
    );
    const res = await app.request(`http://test${path}`, { method: "POST" });
    expect(res.status).toBe(403);
    expect(runTransition).not.toHaveBeenCalled();
  });

  it("returns 403 for finance (non-platform-admin shell)", async () => {
    const runTransition = vi.fn();
    const app = lifecycleApp(
      minimalContainer({ legalEntityLifecycleAdminService: { runTransition } }),
      ADMIN_ID,
      "staff",
      ["finance"],
    );
    const res = await app.request(`http://test${path}`, { method: "POST" });
    expect(res.status).toBe(403);
    expect(runTransition).not.toHaveBeenCalled();
  });

  it("returns 403 when administrator lacks legal_entity.write", async () => {
    denyCapabilityForSuperAdmin("legal_entity.write");
    const runTransition = vi.fn();
    const app = lifecycleApp(
      minimalContainer({ legalEntityLifecycleAdminService: { runTransition } }),
      ADMIN_ID,
      "staff",
    );
    const res = await app.request(`http://test${path}`, { method: "POST" });
    expect(res.status).toBe(403);
    expect(runTransition).not.toHaveBeenCalled();
  });

  it("returns 200 and publishes legal_entity.docs_requested", async () => {
    const { app, publish } = buildAppWithRealLifecycleService("lead");
    const res = await app.request(`http://test${path}`, { method: "POST" });
    expect(res.status).toBe(200);
    expect(publish).toHaveBeenCalledTimes(1);
    const event = publish.mock.calls[0]?.[0] as {
      eventType: string;
      payload: { to_status: string };
    };
    expect(event.eventType).toBe("legal_entity.docs_requested");
    expect(event.payload.to_status).toBe("docs_requested");
    const body = (await res.json()) as { data: { status: string } };
    expect(body.data.status).toBe("docs_requested");
  });

  it("returns 409 concurrent_modification when locked row status differs from outer select", async () => {
    const { app, publish } = buildAppWithRealLifecycleServiceStatusPair("lead", "docs_requested");
    const res = await app.request(`http://test${path}`, { method: "POST" });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("concurrent_modification");
    expect(publish).not.toHaveBeenCalled();
  });

  it("maps invalid_transition (422) from service to HTTP 422", async () => {
    const runTransition = vi.fn().mockResolvedValue(
      err({
        code: "invalid_transition",
        message: "Cannot apply request_docs from status approved",
        status: 422,
      }),
    );
    const app = lifecycleApp(
      minimalContainer({ legalEntityLifecycleAdminService: { runTransition } }),
      ADMIN_ID,
      "staff",
    );
    const res = await app.request(`http://test${path}`, { method: "POST" });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid_transition");
  });
});

describe("POST /admin/legal-entities/:id/start-review (legal_entity.write)", () => {
  const path = `/legal-entities/${ENTITY_ID}/start-review`;

  it("returns 403 for client", async () => {
    const runTransition = vi.fn();
    const app = lifecycleApp(
      minimalContainer({ legalEntityLifecycleAdminService: { runTransition } }),
      ADMIN_ID,
      "client",
    );
    expect((await app.request(`http://test${path}`, { method: "POST" })).status).toBe(403);
    expect(runTransition).not.toHaveBeenCalled();
  });

  it("returns 403 when administrator lacks legal_entity.write", async () => {
    denyCapabilityForSuperAdmin("legal_entity.write");
    const runTransition = vi.fn();
    const app = lifecycleApp(
      minimalContainer({ legalEntityLifecycleAdminService: { runTransition } }),
      ADMIN_ID,
      "staff",
    );
    expect((await app.request(`http://test${path}`, { method: "POST" })).status).toBe(403);
    expect(runTransition).not.toHaveBeenCalled();
  });

  it("returns 200 and publishes legal_entity.review_started", async () => {
    const { app, publish } = buildAppWithRealLifecycleService("docs_received");
    const res = await app.request(`http://test${path}`, { method: "POST" });
    expect(res.status).toBe(200);
    const event = publish.mock.calls[0]?.[0] as { eventType: string };
    expect(event.eventType).toBe("legal_entity.review_started");
  });
});

describe("POST /admin/legal-entities/:id/approve (legal_entity.approve)", () => {
  const path = `/legal-entities/${ENTITY_ID}/approve`;

  it("returns 403 for client", async () => {
    const runTransition = vi.fn();
    const app = lifecycleApp(
      minimalContainer({ legalEntityLifecycleAdminService: { runTransition } }),
      ADMIN_ID,
      "client",
    );
    expect((await app.request(`http://test${path}`, { method: "POST" })).status).toBe(403);
  });

  it("returns 403 when administrator lacks legal_entity.approve", async () => {
    denyCapabilityForSuperAdmin("legal_entity.approve");
    const runTransition = vi.fn();
    const app = lifecycleApp(
      minimalContainer({ legalEntityLifecycleAdminService: { runTransition } }),
      ADMIN_ID,
      "staff",
    );
    expect((await app.request(`http://test${path}`, { method: "POST" })).status).toBe(403);
    expect(runTransition).not.toHaveBeenCalled();
  });

  it("returns 200 and publishes legal_entity.approved", async () => {
    const { app, publish } = buildAppWithRealLifecycleService("under_review");
    const res = await app.request(`http://test${path}`, { method: "POST" });
    expect(res.status).toBe(200);
    const event = publish.mock.calls[0]?.[0] as { eventType: string };
    expect(event.eventType).toBe("legal_entity.approved");
  });
});

describe("POST /admin/legal-entities/:id/restrict (legal_entity.write)", () => {
  const path = `/legal-entities/${ENTITY_ID}/restrict`;

  it("returns 403 for client", async () => {
    const runTransition = vi.fn();
    const app = lifecycleApp(
      minimalContainer({ legalEntityLifecycleAdminService: { runTransition } }),
      ADMIN_ID,
      "client",
    );
    expect((await app.request(`http://test${path}`, { method: "POST" })).status).toBe(403);
  });

  it("returns 403 when administrator lacks legal_entity.write", async () => {
    denyCapabilityForSuperAdmin("legal_entity.write");
    const runTransition = vi.fn();
    const app = lifecycleApp(
      minimalContainer({ legalEntityLifecycleAdminService: { runTransition } }),
      ADMIN_ID,
      "staff",
    );
    expect((await app.request(`http://test${path}`, { method: "POST" })).status).toBe(403);
    expect(runTransition).not.toHaveBeenCalled();
  });

  it("returns 200 and publishes legal_entity.restricted", async () => {
    const { app, publish } = buildAppWithRealLifecycleService("approved");
    const res = await app.request(`http://test${path}`, { method: "POST" });
    expect(res.status).toBe(200);
    const event = publish.mock.calls[0]?.[0] as { eventType: string };
    expect(event.eventType).toBe("legal_entity.restricted");
  });
});

describe("POST /admin/legal-entities/:id/reject (legal_entity.approve)", () => {
  const path = `/legal-entities/${ENTITY_ID}/reject`;

  it("returns 403 for client", async () => {
    const runTransition = vi.fn();
    const app = lifecycleApp(
      minimalContainer({ legalEntityLifecycleAdminService: { runTransition } }),
      ADMIN_ID,
      "client",
    );
    expect(
      (
        await app.request(`http://test${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "valid reason text here" }),
        })
      ).status,
    ).toBe(403);
  });

  it("returns 403 when administrator lacks legal_entity.approve", async () => {
    denyCapabilityForSuperAdmin("legal_entity.approve");
    const runTransition = vi.fn();
    const app = lifecycleApp(
      minimalContainer({ legalEntityLifecycleAdminService: { runTransition } }),
      ADMIN_ID,
      "staff",
    );
    const res = await app.request(`http://test${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "valid reason text here" }),
    });
    expect(res.status).toBe(403);
    expect(runTransition).not.toHaveBeenCalled();
  });

  it("returns 200 and publishes legal_entity.rejected", async () => {
    const { app, publish } = buildAppWithRealLifecycleService("lead");
    const res = await app.request(`http://test${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: "Does not meet documentation standards.",
        confirmationPhrase: "REJECT",
      }),
    });
    expect(res.status).toBe(200);
    const event = publish.mock.calls[0]?.[0] as { eventType: string; payload: { reason: string } };
    expect(event.eventType).toBe("legal_entity.rejected");
    expect(event.payload.reason).toBe("Does not meet documentation standards.");
  });

  it("returns 400 when reason is missing", async () => {
    const runTransition = vi.fn();
    const app = lifecycleApp(
      minimalContainer({ legalEntityLifecycleAdminService: { runTransition } }),
      ADMIN_ID,
      "staff",
    );
    const res = await app.request(`http://test${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    expect(runTransition).not.toHaveBeenCalled();
  });

  it("returns 400 when reason is shorter than 3 characters", async () => {
    const runTransition = vi.fn();
    const app = lifecycleApp(
      minimalContainer({ legalEntityLifecycleAdminService: { runTransition } }),
      ADMIN_ID,
      "staff",
    );
    const res = await app.request(`http://test${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "no" }),
    });
    expect(res.status).toBe(400);
    expect(runTransition).not.toHaveBeenCalled();
  });
});

describe("POST /admin/legal-entities/:id/archive (legal_entity.archive)", () => {
  const path = `/legal-entities/${ENTITY_ID}/archive`;

  it("returns 403 for client", async () => {
    const runTransition = vi.fn();
    const app = lifecycleApp(
      minimalContainer({ legalEntityLifecycleAdminService: { runTransition } }),
      ADMIN_ID,
      "client",
    );
    const res = await app.request(`http://test${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "valid archive reason here" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 403 when administrator lacks legal_entity.archive", async () => {
    denyCapabilityForSuperAdmin("legal_entity.archive");
    const runTransition = vi.fn();
    const app = lifecycleApp(
      minimalContainer({ legalEntityLifecycleAdminService: { runTransition } }),
      ADMIN_ID,
      "staff",
    );
    const res = await app.request(`http://test${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "valid archive reason here" }),
    });
    expect(res.status).toBe(403);
    expect(runTransition).not.toHaveBeenCalled();
  });

  it("returns 200 and publishes legal_entity.archived", async () => {
    const { app, publish } = buildAppWithRealLifecycleService("connect_pending");
    const res = await app.request(`http://test${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: "Organisation requested removal.",
        confirmationPhrase: "ARCHIVE Test Entity Ltd",
      }),
    });
    expect(res.status).toBe(200);
    const event = publish.mock.calls[0]?.[0] as { eventType: string };
    expect(event.eventType).toBe("legal_entity.archived");
  });

  it("returns 400 when reason is missing", async () => {
    const runTransition = vi.fn();
    const app = lifecycleApp(
      minimalContainer({ legalEntityLifecycleAdminService: { runTransition } }),
      ADMIN_ID,
      "staff",
    );
    const res = await app.request(`http://test${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    expect(runTransition).not.toHaveBeenCalled();
  });

  it("returns 400 when reason is shorter than 3 characters", async () => {
    const runTransition = vi.fn();
    const app = lifecycleApp(
      minimalContainer({ legalEntityLifecycleAdminService: { runTransition } }),
      ADMIN_ID,
      "staff",
    );
    const res = await app.request(`http://test${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "ab" }),
    });
    expect(res.status).toBe(400);
    expect(runTransition).not.toHaveBeenCalled();
  });
});

describe("POST /admin/legal-entities/:id/lift-restriction (legal_entity.write + step-up)", () => {
  const path = `/legal-entities/${ENTITY_ID}/lift-restriction`;
  const connectReady = {
    stripeConnectAccountId: "acct_1",
    stripeConnectChargesEnabled: true,
    stripeConnectPayoutsEnabled: true,
    stripeConnectRequirementsCurrentlyDue: [],
    stripeConnectRequirementsErrors: [],
    stripeConnectDisabledReason: null,
    isLaxManaged: false,
  };
  const post = (
    app: { request: (u: string, i: RequestInit) => Response | Promise<Response> },
    body: unknown,
  ) =>
    app.request(`http://test${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  it("returns 403 for client", async () => {
    const runTransition = vi.fn();
    const app = lifecycleApp(
      minimalContainer({ legalEntityLifecycleAdminService: { runTransition } }),
      ADMIN_ID,
      "client",
    );
    expect((await post(app, { reason: "Cleared by compliance" })).status).toBe(403);
    expect(runTransition).not.toHaveBeenCalled();
  });

  it("returns 403 when administrator lacks legal_entity.write", async () => {
    denyCapabilityForSuperAdmin("legal_entity.write");
    const runTransition = vi.fn();
    const app = lifecycleApp(
      minimalContainer({ legalEntityLifecycleAdminService: { runTransition } }),
      ADMIN_ID,
      "staff",
    );
    expect((await post(app, { reason: "Cleared by compliance" })).status).toBe(403);
    expect(runTransition).not.toHaveBeenCalled();
  });

  it("returns 403 step_up_required without a recent sign-in", async () => {
    const { app, publish } = buildAppWithRealLifecycleService("restricted", connectReady, false);
    const res = await post(app, { reason: "Cleared by compliance" });
    expect(res.status).toBe(403);
    expect(((await res.json()) as { code: string }).code).toBe("step_up_required");
    expect(publish).not.toHaveBeenCalled();
  });

  it("returns 400 when the reason is missing or too short", async () => {
    const runTransition = vi.fn();
    const app = lifecycleApp(
      minimalContainer({ legalEntityLifecycleAdminService: { runTransition } }),
      ADMIN_ID,
      "staff",
    );
    expect((await post(app, {})).status).toBe(400);
    expect((await post(app, { reason: "ab" })).status).toBe(400);
    expect(runTransition).not.toHaveBeenCalled();
  });

  it("returns 422 from a status other than restricted", async () => {
    const { app, publish } = buildAppWithRealLifecycleService("approved", connectReady);
    expect((await post(app, { reason: "Cleared by compliance" })).status).toBe(422);
    expect(publish).not.toHaveBeenCalled();
  });

  it("returns 200 approved and publishes legal_entity.restriction_lifted when Connect is ready", async () => {
    const { app, publish } = buildAppWithRealLifecycleService("restricted", connectReady);
    const res = await post(app, { reason: "Cleared by compliance" });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { data: { status: string } }).data.status).toBe("approved");
    const event = publish.mock.calls[0]?.[0] as {
      eventType: string;
      payload: Record<string, unknown>;
      actorUserId: string;
    };
    expect(event.eventType).toBe("legal_entity.restriction_lifted");
    expect(event.payload).toMatchObject({
      from_status: "restricted",
      to_status: "approved",
      reason: "Cleared by compliance",
    });
    expect(event.actorUserId).toBe(ADMIN_ID);
  });

  it("returns 200 connect_pending when Connect is not ready", async () => {
    const { app } = buildAppWithRealLifecycleService("restricted", {
      ...connectReady,
      stripeConnectPayoutsEnabled: false,
    });
    const res = await post(app, { reason: "Cleared by compliance" });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { data: { status: string } }).data.status).toBe(
      "connect_pending",
    );
  });
});
