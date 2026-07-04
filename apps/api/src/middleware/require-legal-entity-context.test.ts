import type { ActiveMembership, ILegalEntityRepository } from "@auction/persistence/interfaces";
import { ACTING_LEGAL_ENTITY_COOKIE_NAME, encodeActingContextCookie } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { PersonalLegalEntityUnavailableError } from "../services/legal-entity/personal-legal-entity-resolver.service.js";
import {
  X_LEGAL_ENTITY_ID_HEADER,
  createOptionalLegalEntityContext,
  createRequireLegalEntityContext,
  createSubmissionsLegalEntityContext,
} from "./require-legal-entity-context.js";

const ENTITY_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "user-1";

function repo(
  membership: ActiveMembership | null,
  ensurePersonalEntity?: ILegalEntityRepository["ensurePersonalEntity"],
) {
  const findActiveMembership = vi.fn().mockResolvedValue(membership);
  const stub: ILegalEntityRepository = {
    findById: vi.fn(),
    findByIds: vi.fn().mockResolvedValue([]),
    listActiveMembershipsForUser: vi.fn(),
    findActiveMembership,
    listImpersonationNoticeRecipientEmails: vi.fn().mockResolvedValue([]),
    setXeroContactId: vi.fn(),
    setStripeCustomerId: vi.fn(),
    findPrimaryAddressForXero: vi.fn().mockResolvedValue(null),
    findPreferredBillToLegalEntityAddress: vi.fn().mockResolvedValue(null),
    ensurePersonalEntity: ensurePersonalEntity ?? vi.fn(),
    advanceIndividualLeadsToConnectPendingAfterKyc: vi.fn().mockResolvedValue([]),
  };
  return { stub, findActiveMembership };
}

function submissionsMiddleware(
  stub: ILegalEntityRepository,
  resolvePersonalEntity: (userId: string) => Promise<{
    id: string;
    displayName: string;
    kind: "individual";
    subkind: "private_collector";
    status: "approved";
    role: "owner";
    isPrimaryAdmin: boolean;
  }>,
) {
  return createSubmissionsLegalEntityContext(stub, {
    resolvePersonalEntity,
  });
}

function appWithMiddleware(
  mw: ReturnType<typeof createRequireLegalEntityContext>,
  opts: { setUserId?: string | undefined; setUserRole?: string; setUserStaffRole?: string } = {},
) {
  const app = new Hono<{
    Variables: {
      userId?: string;
      userRole?: string;
      userStaffRole?: string | null;
      legalEntityContext?: ActiveMembership;
    };
  }>();
  app.use("*", async (c, next) => {
    if (opts.setUserId !== undefined) c.set("userId", opts.setUserId);
    if (opts.setUserRole !== undefined) c.set("userRole", opts.setUserRole);
    if (opts.setUserStaffRole !== undefined) c.set("userStaffRole", opts.setUserStaffRole);
    await next();
  });
  app.use("*", mw);
  app.get("/", (c) => c.json({ context: c.get("legalEntityContext") ?? null }));
  return app;
}

describe("createRequireLegalEntityContext (required)", () => {
  it("returns 401 when there is no authenticated userId", async () => {
    const { stub, findActiveMembership } = repo(null);
    const app = appWithMiddleware(createRequireLegalEntityContext(stub), {
      setUserId: undefined,
    });

    const res = await app.request("/", {
      headers: { [X_LEGAL_ENTITY_ID_HEADER]: ENTITY_ID },
    });

    expect(res.status).toBe(401);
    expect(findActiveMembership).not.toHaveBeenCalled();
  });

  it("returns 400 when the X-Legal-Entity-Id header is missing", async () => {
    const { stub, findActiveMembership } = repo(null);
    const app = appWithMiddleware(createRequireLegalEntityContext(stub), {
      setUserId: USER_ID,
    });

    const res = await app.request("/");

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("missing_legal_entity_context");
    expect(findActiveMembership).not.toHaveBeenCalled();
  });

  it("returns 403 when the user is not an active member of the entity", async () => {
    const { stub, findActiveMembership } = repo(null);
    const app = appWithMiddleware(createRequireLegalEntityContext(stub), {
      setUserId: USER_ID,
    });

    const res = await app.request("/", {
      headers: { [X_LEGAL_ENTITY_ID_HEADER]: ENTITY_ID },
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("not_a_member_of_legal_entity");
    expect(findActiveMembership).toHaveBeenCalledWith(USER_ID, ENTITY_ID);
  });

  it("attaches legalEntityContext on success", async () => {
    const membership: ActiveMembership = {
      legalEntityId: ENTITY_ID,
      userId: USER_ID,
      role: "owner",
      isPrimaryAdmin: true,
    };
    const { stub } = repo(membership);
    const app = appWithMiddleware(createRequireLegalEntityContext(stub), {
      setUserId: USER_ID,
    });

    const res = await app.request("/", {
      headers: { [X_LEGAL_ENTITY_ID_HEADER]: ENTITY_ID },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { context: ActiveMembership };
    expect(body.context).toMatchObject({
      legalEntityId: ENTITY_ID,
      userId: USER_ID,
      role: "owner",
      isPrimaryAdmin: true,
    });
  });

  it("allows platform administrator impersonation when cookie session is valid", async () => {
    const { stub } = repo(null);
    const sid = "22222222-2222-4222-8222-222222222222";
    const cookieVal = encodeURIComponent(
      encodeActingContextCookie({
        v: 1,
        e: ENTITY_ID,
        n: "Acme",
        i: { sid: sid },
      }),
    );
    const mw = createRequireLegalEntityContext(stub, {
      impersonationSessions: {
        validateForRequest: vi.fn().mockResolvedValue({
          ok: true,
          session: { id: sid, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
        }),
      },
    });
    const app = appWithMiddleware(mw, {
      setUserId: USER_ID,
      setUserRole: "staff",
      setUserStaffRole: "super_admin",
    });

    const res = await app.request("/", {
      headers: {
        [X_LEGAL_ENTITY_ID_HEADER]: ENTITY_ID,
        Cookie: `${ACTING_LEGAL_ENTITY_COOKIE_NAME}=${cookieVal}`,
      },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { context: ActiveMembership };
    expect(body.context).toMatchObject({
      legalEntityId: ENTITY_ID,
      userId: USER_ID,
      role: "admin",
      isPrimaryAdmin: true,
      isImpersonation: true,
      impersonationSessionId: sid,
    });
  });

  it("returns impersonation_session_expired for expired impersonation cookie", async () => {
    const { stub } = repo(null);
    const onExpired = vi.fn().mockResolvedValue(undefined);
    const sid = "33333333-3333-4333-8333-333333333333";
    const cookieVal = encodeURIComponent(
      encodeActingContextCookie({
        v: 1,
        e: ENTITY_ID,
        i: { sid: sid },
      }),
    );
    const mw = createRequireLegalEntityContext(stub, {
      onImpersonationExpired: onExpired,
      impersonationSessions: {
        validateForRequest: vi.fn().mockResolvedValue({ ok: false, reason: "expired" }),
      },
    });
    const app = appWithMiddleware(mw, {
      setUserId: USER_ID,
      setUserRole: "staff",
      setUserStaffRole: "super_admin",
    });

    const res = await app.request("/", {
      headers: {
        [X_LEGAL_ENTITY_ID_HEADER]: ENTITY_ID,
        Cookie: `${ACTING_LEGAL_ENTITY_COOKIE_NAME}=${cookieVal}`,
      },
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("impersonation_session_expired");
    expect(onExpired).toHaveBeenCalledWith({
      sessionId: sid,
      actorUserId: USER_ID,
      actingLegalEntityId: ENTITY_ID,
    });
  });

  it("rejects a tampered impersonation session id", async () => {
    const { stub } = repo(null);
    const sid = "44444444-4444-4444-8444-444444444444";
    const cookieVal = encodeURIComponent(
      encodeActingContextCookie({
        v: 1,
        e: ENTITY_ID,
        i: { sid },
      }),
    );
    const mw = createRequireLegalEntityContext(stub, {
      impersonationSessions: {
        validateForRequest: vi.fn().mockResolvedValue({ ok: false, reason: "not_found" }),
      },
    });
    const app = appWithMiddleware(mw, {
      setUserId: USER_ID,
      setUserRole: "staff",
      setUserStaffRole: "super_admin",
    });

    const res = await app.request("/", {
      headers: {
        [X_LEGAL_ENTITY_ID_HEADER]: ENTITY_ID,
        Cookie: `${ACTING_LEGAL_ENTITY_COOKIE_NAME}=${cookieVal}`,
      },
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("invalid_impersonation_session");
  });
});

describe("createSubmissionsLegalEntityContext", () => {
  const PERSONAL_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const personalSummary = {
    id: PERSONAL_ID,
    displayName: "Me",
    kind: "individual" as const,
    subkind: "private_collector" as const,
    status: "approved" as const,
    role: "owner" as const,
    isPrimaryAdmin: true,
  };

  it("uses personal entity when header is missing and membership is active", async () => {
    const membership: ActiveMembership = {
      legalEntityId: PERSONAL_ID,
      userId: USER_ID,
      role: "owner",
      isPrimaryAdmin: true,
    };
    const resolvePersonalEntity = vi.fn().mockResolvedValue(personalSummary);
    const { stub, findActiveMembership } = repo(membership);
    const app = appWithMiddleware(submissionsMiddleware(stub, resolvePersonalEntity), {
      setUserId: USER_ID,
    });

    const res = await app.request("/");

    expect(res.status).toBe(200);
    expect(resolvePersonalEntity).toHaveBeenCalledWith(USER_ID);
    expect(findActiveMembership).toHaveBeenCalledWith(USER_ID, PERSONAL_ID);
    const body = (await res.json()) as { context: ActiveMembership };
    expect(body.context?.legalEntityId).toBe(PERSONAL_ID);
  });

  it("returns 403 when personal entity cannot be resolved", async () => {
    const resolvePersonalEntity = vi
      .fn()
      .mockRejectedValue(new PersonalLegalEntityUnavailableError(USER_ID));
    const { stub, findActiveMembership } = repo(null);
    const app = appWithMiddleware(submissionsMiddleware(stub, resolvePersonalEntity), {
      setUserId: USER_ID,
    });

    const res = await app.request("/");

    expect(res.status).toBe(403);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("no_valid_legal_entity_for_submissions");
    expect(findActiveMembership).not.toHaveBeenCalled();
  });

  it("returns 403 when personal entity exists but membership is not active", async () => {
    const resolvePersonalEntity = vi.fn().mockResolvedValue({
      ...personalSummary,
      status: "rejected" as const,
    });
    const { stub, findActiveMembership } = repo(null);
    const app = appWithMiddleware(submissionsMiddleware(stub, resolvePersonalEntity), {
      setUserId: USER_ID,
    });

    const res = await app.request("/");

    expect(res.status).toBe(403);
    expect(findActiveMembership).toHaveBeenCalledWith(USER_ID, PERSONAL_ID);
  });

  it("still validates explicit header (403 for unknown entity)", async () => {
    const resolvePersonalEntity = vi.fn();
    const { stub, findActiveMembership } = repo(null);
    const app = appWithMiddleware(submissionsMiddleware(stub, resolvePersonalEntity), {
      setUserId: USER_ID,
    });

    const res = await app.request("/", {
      headers: { [X_LEGAL_ENTITY_ID_HEADER]: ENTITY_ID },
    });

    expect(res.status).toBe(403);
    expect(resolvePersonalEntity).not.toHaveBeenCalled();
    expect(findActiveMembership).toHaveBeenCalledWith(USER_ID, ENTITY_ID);
  });

  it("lazy-provisions personal entity via resolver when header is missing", async () => {
    const membership: ActiveMembership = {
      legalEntityId: PERSONAL_ID,
      userId: USER_ID,
      role: "owner",
      isPrimaryAdmin: true,
    };
    const resolvePersonalEntity = vi.fn().mockResolvedValue(personalSummary);
    const { stub, findActiveMembership } = repo(membership);
    const app = appWithMiddleware(submissionsMiddleware(stub, resolvePersonalEntity), {
      setUserId: USER_ID,
    });

    const res = await app.request("/");

    expect(res.status).toBe(200);
    expect(resolvePersonalEntity).toHaveBeenCalledTimes(1);
    expect(findActiveMembership).toHaveBeenCalledWith(USER_ID, PERSONAL_ID);
  });
});

describe("createOptionalLegalEntityContext", () => {
  it("falls through (no context) when header is missing", async () => {
    const { stub, findActiveMembership } = repo(null);
    const app = appWithMiddleware(createOptionalLegalEntityContext(stub), {
      setUserId: USER_ID,
    });

    const res = await app.request("/");

    expect(res.status).toBe(200);
    const body = (await res.json()) as { context: ActiveMembership | null };
    expect(body.context).toBeNull();
    expect(findActiveMembership).not.toHaveBeenCalled();
  });

  it("falls through (no context) when user is unauthenticated", async () => {
    const { stub } = repo(null);
    const app = appWithMiddleware(createOptionalLegalEntityContext(stub), {
      setUserId: undefined,
    });

    const res = await app.request("/", {
      headers: { [X_LEGAL_ENTITY_ID_HEADER]: ENTITY_ID },
    });

    expect(res.status).toBe(200);
  });

  it("still 403s when user is authenticated but membership is missing", async () => {
    const { stub } = repo(null);
    const app = appWithMiddleware(createOptionalLegalEntityContext(stub), {
      setUserId: USER_ID,
    });

    const res = await app.request("/", {
      headers: { [X_LEGAL_ENTITY_ID_HEADER]: ENTITY_ID },
    });

    expect(res.status).toBe(403);
  });
});
