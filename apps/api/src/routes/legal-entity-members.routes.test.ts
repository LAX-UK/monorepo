import type { IEntityInvitationRepository } from "@auction/persistence/interfaces";
import type { LegalEntityMemberRole } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { ContainerLegalEntityMemberRoutesSlice } from "../container.js";
import type { LegalEntityContext } from "../middleware/require-legal-entity-context.js";
import { IdentityLegalEntityMemberHttpApplicationService } from "../services/identity/identity-legal-entity-member-http-application.service.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { InvitationLifecycleService } from "../services/invitation-lifecycle.service.js";
import { OrganisationInvitationService } from "../services/invitation/organisation-invitation.service.js";
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

type StoredInvitation = {
  id: string;
  email: string;
  targetLegalEntityId: string;
  targetLegalEntityMemberRole: LegalEntityMemberRole;
  status: "pending" | "revoked";
  createdAt: Date;
  expiresAt: Date;
};

/** Two open invitations to this organisation (a viewer and an owner) and one to another. */
function invitationStore(): Map<string, StoredInvitation> {
  const week = new Date(Date.now() + 7 * 86_400_000);
  const invite = (name: string, role: LegalEntityMemberRole, legalEntityId = TEST_ENTITY_ID) => ({
    id: idOf(name),
    email: `${name}@example.com`,
    targetLegalEntityId: legalEntityId,
    targetLegalEntityMemberRole: role,
    status: "pending" as const,
    createdAt: new Date(),
    expiresAt: week,
  });
  return new Map(
    [
      invite("invite-viewer", "viewer"),
      invite("invite-owner", "owner"),
      invite("invite-other-org", "viewer", OTHER_ORG),
    ].map((row) => [row.id, row]),
  );
}

function invitationRepo(
  store: Map<string, StoredInvitation> = invitationStore(),
): IEntityInvitationRepository {
  const pending = (row: StoredInvitation) => row.status === "pending";
  const repo = {
    forConnection: () => repo,
    findUserIdByEmail: async () => null,
    userExistsByEmail: async () => false,
    hasActiveMember: async () => false,
    revokePendingForEntity: async () => {},
    insertInvitation: vi.fn(async () => {}),
    findByTokenHash: async () => null,
    findById: async (id: string) => store.get(id) ?? null,
    insertMember: async () => null,
    markInvitationAccepted: async () => {},
    markInvitationRevoked: async (id: string) => {
      const row = store.get(id);
      if (row) row.status = "revoked";
    },
    listPendingForEntity: async (legalEntityId: string) =>
      [...store.values()]
        .filter((row) => pending(row) && row.targetLegalEntityId === legalEntityId)
        .map((row) => ({
          id: row.id,
          email: row.email,
          role: row.targetLegalEntityMemberRole,
          sentAt: row.createdAt,
          expiresAt: row.expiresAt,
        })),
    hasPendingForEntity: async (email: string, legalEntityId: string) =>
      [...store.values()].some(
        (row) => pending(row) && row.email === email && row.targetLegalEntityId === legalEntityId,
      ),
    markInvitationPending: async (id: string) => {
      const row = store.get(id);
      if (row?.status !== "revoked") return false;
      row.status = "pending";
      return true;
    },
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
    accounts: { findById: async () => ({ kind: "organisation" }) as never },
    leaveNotifier: { memberLeft: async () => undefined },
  });
  const store = invitationStore();
  const invitationRows = invitationRepo(store);
  const invitations = new InvitationLifecycleService(
    transactionRunner,
    invitationRows,
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
    new OrganisationInvitationService({
      transactionRunner,
      invitations: invitationRows,
      membership: guard,
      domainEventSink: sink,
    }),
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
  return { send, byId, store };
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

  it("removes an admin without a typed phrase; the dialog confirms it", async () => {
    const { send, byId } = mount("owner");
    const res = await send("DELETE", `/members/${idOf("admin")}`);
    expect(res.status).toBe(200);
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
    const phrase = `Transfer to Name ${idOf("admin")}`;
    const request = { memberId: idOf("admin"), confirmationPhrase: phrase };
    const asAdmin = await mount("admin").send("POST", "/members/transfer-ownership", {
      ...request,
      memberId: idOf("finance"),
    });
    expect(asAdmin.status).toBe(403);
    expect((await body(asAdmin)).code).toBe("owner_only");

    const { send, byId } = mount("owner");
    expect((await send("POST", "/members/transfer-ownership", request)).status).toBe(200);
    expect(byId.get(idOf("admin"))).toMatchObject({ role: "owner", isPrimaryAdmin: true });
    expect(byId.get(idOf("owner"))).toMatchObject({ role: "admin", isPrimaryAdmin: false });
  });
});

describe("pending invitations", () => {
  it.each(ROLES)("are listed to owners and admins only (as %s)", async (role) => {
    const res = await mount(role).send("GET", "/invitations");
    if (role === "owner" || role === "admin") {
      expect(res.status).toBe(200);
      const rows = (await body(res)).data as { id: string; role: string }[];
      expect(rows.map((r) => r.role).sort()).toEqual(["owner", "viewer"]);
    } else {
      expect(res.status).toBe(403);
    }
  });

  it("lets an admin withdraw a viewer's invitation, and take it back", async () => {
    const { send, store } = mount("admin");
    expect((await send("DELETE", `/invitations/${idOf("invite-viewer")}`)).status).toBe(200);
    expect(store.get(idOf("invite-viewer"))?.status).toBe("revoked");
    expect((await send("POST", `/invitations/${idOf("invite-viewer")}/restore`)).status).toBe(200);
    expect(store.get(idOf("invite-viewer"))?.status).toBe("pending");
  });

  it("keeps owner invitations to owners", async () => {
    const res = await mount("admin").send("DELETE", `/invitations/${idOf("invite-owner")}`);
    expect(res.status).toBe(403);
    expect((await body(res)).code).toBe("owner_only");
    expect(
      (await mount("owner").send("DELETE", `/invitations/${idOf("invite-owner")}`)).status,
    ).toBe(200);
  });

  it.each(["finance", "consignor", "viewer", "buyer_agent"] as const)(
    "refuses a %s",
    async (role) => {
      const res = await mount(role).send("DELETE", `/invitations/${idOf("invite-viewer")}`);
      expect(res.status).toBe(403);
    },
  );

  it("answers not found for another organisation's invitation", async () => {
    const res = await mount("owner").send("DELETE", `/invitations/${idOf("invite-other-org")}`);
    expect(res.status).toBe(404);
  });

  it("will not reopen an invitation that was never withdrawn", async () => {
    const res = await mount("owner").send("POST", `/invitations/${idOf("invite-viewer")}/restore`);
    expect(res.status).toBe(409);
    expect((await body(res)).code).toBe("invitation_not_restorable");
  });
});

describe("POST /legal-entities/members/leave", () => {
  it("lets any member leave, whatever their role", async () => {
    const { send, byId } = mount("viewer");
    const res = await send("POST", "/members/leave");
    expect(res.status).toBe(200);
    expect((await body(res)).data).toEqual({ left: true });
    expect(byId.get(idOf("viewer"))?.removedAt).toBeInstanceOf(Date);
  });

  it("refuses the last owner with the reason key until ownership is handed on", async () => {
    const { send } = mount("owner");
    expect((await send("DELETE", `/members/${idOf("owner2")}`)).status).toBe(200);
    const res = await send("POST", "/members/leave");
    expect(res.status).toBe(409);
    expect(await body(res)).toMatchObject({ code: "last_owner_must_transfer" });
  });

  it("refuses support staff viewing as the client, who are not members", async () => {
    const res = await mount("admin", { impersonation: true }).send("POST", "/members/leave");
    expect(res.status).toBe(403);
  });
});
