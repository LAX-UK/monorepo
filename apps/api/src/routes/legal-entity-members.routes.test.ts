import type { IEntityInvitationRepository } from "@auction/persistence/interfaces";
import type { LegalEntityMemberRole } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { ContainerLegalEntityMemberRoutesSlice } from "../container.js";
import type { LegalEntityContext } from "../middleware/require-legal-entity-context.js";
import { IdentityLegalEntityMemberHttpApplicationService } from "../services/identity/identity-legal-entity-member-http-application.service.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { InvitationLifecycleService } from "../services/invitation-lifecycle.service.js";
import { LegalEntityMembershipGuard } from "../services/legal-entity-membership.guard.js";
import { MemberManagementService } from "../services/member-management.service.js";
import type { UserService } from "../services/user.service.js";
import { mockDomainEventSink } from "../test/domain-event-sink-mock.js";
import {
  TEST_ENTITY_ID,
  inMemoryLegalEntityMembers,
  memberRow,
} from "../testing/in-memory-legal-entity-members.js";
import { createLegalEntityMemberRoutes } from "./legal-entity-members.js";

const ROLES = ["owner", "admin", "finance", "consignor", "viewer", "buyer_agent"] as const;

/** Member ids are uuids on the wire; tests name members by role. */
const ids = new Map<string, string>();
function idOf(name: string): string {
  if (!ids.has(name)) {
    ids.set(name, `00000000-0000-4000-8000-${String(ids.size + 1).padStart(12, "0")}`);
  }
  return ids.get(name) as string;
}
const OTHER_ORG = "99999999-9999-4999-8999-999999999999";

/** One member per role, plus a second owner, so no change is blocked by the last-owner rule. */
function team() {
  const row = (name: string, role: LegalEntityMemberRole, overrides = {}) =>
    memberRow(idOf(name), role, { userId: `user-${name}`, ...overrides });
  return [
    row("owner", "owner", { isPrimaryAdmin: true }),
    row("owner2", "owner"),
    ...ROLES.filter((r) => r !== "owner").map((role) => row(role, role)),
    row("other-org", "viewer", { legalEntityId: OTHER_ORG }),
  ];
}

function invitationRepo(): IEntityInvitationRepository {
  const repo = {
    forConnection: () => repo,
    findUserIdByEmail: async () => null,
    userExistsByEmail: async () => false,
    hasActiveMember: async () => false,
    revokePendingForEntity: async () => {},
    insertInvitation: vi.fn(async () => {}),
    findByTokenHash: async () => null,
    findById: async () => null,
    insertMember: async () => null,
    markInvitationAccepted: async () => {},
    markInvitationRevoked: async () => {},
    findUserName: async () => "Admin",
    findUserEmail: async () => "admin@example.com",
    findLegalEntityDisplayName: async () => "Northbank Gallery",
    findLegalEntityStatus: async () => "approved",
  } as unknown as IEntityInvitationRepository;
  return repo;
}

/** The member routes over the real member services, acting as `role` (or as support staff). */
function mount(role: LegalEntityMemberRole, opts: { impersonation?: boolean } = {}) {
  const { repo, byId } = inMemoryLegalEntityMembers(team());
  const sink = mockDomainEventSink();
  const transactionRunner = {
    runInTransaction: <T>(fn: (tx: never) => Promise<T>) => fn({} as never),
  };
  const guard = new LegalEntityMembershipGuard(repo);
  const members = new MemberManagementService({
    transactionRunner,
    members: repo,
    membership: guard,
    domainEventSink: sink,
    bidStopper: { stopFor: async () => [] },
    authorisationRevoker: { revokeFor: vi.fn(async () => undefined) },
    realtime: { notifyProxyCancelled: async () => undefined },
  });
  const invitations = new InvitationLifecycleService(
    transactionRunner,
    invitationRepo(),
    sink,
    { notify: vi.fn(async () => undefined) } as never,
    "https://lax.test",
    guard,
  );
  const memberHttp = new IdentityLegalEntityMemberHttpApplicationService(
    members,
    invitations,
    { isEnabled: () => true, disabledResponse: () => ({ error: "off", code: "off" }) } as never,
    {} as UserService,
  );
  const userId = opts.impersonation ? "support-staff" : `user-${role}`;
  const context: LegalEntityContext = {
    legalEntityId: TEST_ENTITY_ID,
    userId,
    role: opts.impersonation ? "admin" : role,
    isPrimaryAdmin: false,
    ...(opts.impersonation ? { isImpersonation: true } : {}),
  };
  const container = {
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    requireLegalEntityContext: async (
      c: { set: (key: string, value: LegalEntityContext) => void },
      next: () => Promise<void>,
    ) => {
      c.set("legalEntityContext", context);
      await next();
    },
    identityRoutes: { legalEntityMemberHttp: memberHttp },
  } as unknown as ContainerLegalEntityMemberRoutesSlice;
  const authenticator: IAuthenticator = {
    getSessionUser: vi
      .fn()
      .mockResolvedValue({ id: userId, role: "client", scopes: ["bid.read", "bid.write"] }),
  };
  const app = new Hono();
  app.route("/legal-entities", createLegalEntityMemberRoutes(container, authenticator));
  const send = (method: string, path: string, body?: unknown) =>
    app.request(`http://t/legal-entities${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  return { send, byId };
}

async function body(res: Response) {
  return (await res.json()) as { error?: string; code?: string; message?: string; data?: unknown };
}

describe("GET /legal-entities/members", () => {
  it.each(ROLES)("as %s", async (role) => {
    const res = await mount(role).send("GET", "/members");
    if (role === "owner" || role === "admin") {
      expect(res.status).toBe(200);
      const listed = (await body(res)).data as { legalEntityId: string }[];
      // Only this organisation's members, never another's.
      expect(listed).toHaveLength(ROLES.length + 1);
      expect(listed.every((m) => m.legalEntityId === TEST_ENTITY_ID)).toBe(true);
      return;
    }
    expect(res.status).toBe(403);
    expect((await body(res)).message).toBe("Only owners and admins can see the member list.");
  });

  it("is readable by support staff viewing as the client", async () => {
    const res = await mount("admin", { impersonation: true }).send("GET", "/members");
    expect(res.status).toBe(200);
  });
});

describe("member changes per role", () => {
  it.each(ROLES.filter((r) => r !== "owner" && r !== "admin"))(
    "refuses every change to a %s with a reason",
    async (role) => {
      const { send } = mount(role);
      const responses = [
        await send("POST", "/members", { email: "new@example.com", role: "viewer" }),
        await send("PATCH", `/members/${idOf("viewer")}`, { role: "consignor" }),
        await send("DELETE", `/members/${idOf("viewer")}`),
      ];
      for (const res of responses) {
        expect(res.status).toBe(403);
        expect((await body(res)).message).toBe("Only owners and admins can manage members.");
      }
    },
  );

  it("refuses every change to support staff viewing as the client", async () => {
    const res = await mount("admin", { impersonation: true }).send(
      "PATCH",
      `/members/${idOf("viewer")}`,
      { role: "consignor" },
    );
    expect(res.status).toBe(403);
    expect((await body(res)).message).toBe(
      "You're viewing this organisation as LAX support, so changes are turned off.",
    );
  });

  it("lets an admin invite and change roles, but never touch the owner role", async () => {
    const { send } = mount("admin");
    expect(
      (await send("POST", "/members", { email: "a@example.com", role: "viewer" })).status,
    ).toBe(201);
    const invite = await send("POST", "/members", { email: "b@example.com", role: "owner" });
    expect(invite.status).toBe(403);
    expect(await body(invite)).toMatchObject({
      code: "owner_only",
      error: "Only an owner can grant, change or remove the owner role.",
    });
  });

  it("lets an owner invite someone as an owner", async () => {
    const res = await mount("owner").send("POST", "/members", {
      email: "c@example.com",
      role: "owner",
    });
    expect(res.status).toBe(201);
  });
});

describe("role changes, removal and ownership", () => {
  it("lets an admin change roles but never an owner's", async () => {
    const { send, byId } = mount("admin");
    expect((await send("PATCH", `/members/${idOf("viewer")}`, { role: "consignor" })).status).toBe(
      200,
    );
    expect(byId.get(idOf("viewer"))?.role).toBe("consignor");
    const demote = await send("PATCH", `/members/${idOf("owner2")}`, { role: "admin" });
    expect(demote.status).toBe(403);
    expect((await body(demote)).code).toBe("owner_only");
    const promote = await send("PATCH", `/members/${idOf("finance")}`, { role: "owner" });
    expect(promote.status).toBe(403);
  });

  it("lets an owner make another member an owner", async () => {
    const { send, byId } = mount("owner");
    expect((await send("PATCH", `/members/${idOf("admin")}`, { role: "owner" })).status).toBe(200);
    expect(byId.get(idOf("admin"))?.role).toBe("owner");
  });

  it("stops an admin removing an owner", async () => {
    const res = await mount("admin").send("DELETE", `/members/${idOf("owner")}`);
    expect(res.status).toBe(403);
    expect((await body(res)).code).toBe("owner_only");
  });

  it("asks for the typed phrase before removing an admin", async () => {
    const { send, byId } = mount("owner");
    const unconfirmed = await send("DELETE", `/members/${idOf("admin")}`);
    expect(unconfirmed.status).toBe(400);
    const phrase = `REMOVE Name ${idOf("admin")}`;
    expect(await body(unconfirmed)).toMatchObject({
      code: "confirmation_required",
      message: `Type exactly: ${phrase}`,
    });
    const confirmed = await send("DELETE", `/members/${idOf("admin")}`, {
      confirmationPhrase: phrase,
    });
    expect(confirmed.status).toBe(200);
    expect(byId.get(idOf("admin"))?.removedAt).toBeInstanceOf(Date);
  });

  it("answers not found for another organisation's member", async () => {
    const { send } = mount("owner");
    const remove = await send("DELETE", `/members/${idOf("other-org")}`);
    expect(remove.status).toBe(404);
    const patch = await send("PATCH", `/members/${idOf("other-org")}`, { role: "admin" });
    expect(patch.status).toBe(404);
  });

  it("lets only an owner transfer ownership", async () => {
    const phrase = `TRANSFER PRIMARY TO Name ${idOf("admin")}`;
    const request = { memberId: idOf("admin"), confirmationPhrase: phrase };
    const asAdmin = await mount("admin").send("POST", "/members/transfer-primary-admin", {
      ...request,
      memberId: idOf("finance"),
    });
    expect(asAdmin.status).toBe(403);
    expect((await body(asAdmin)).code).toBe("owner_only");

    const { send, byId } = mount("owner");
    expect((await send("POST", "/members/transfer-primary-admin", request)).status).toBe(200);
    expect(byId.get(idOf("admin"))).toMatchObject({ role: "owner", isPrimaryAdmin: true });
    expect(byId.get(idOf("owner"))).toMatchObject({ role: "admin", isPrimaryAdmin: false });
  });
});
