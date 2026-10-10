import type { LaxStaffAccessHistoryEntry } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { StaffAccessAdminService, platformView } from "./staff-access-admin.service.js";

const SUPER = { userId: "usr_super", role: "staff", staffRole: "super_admin" };
const ADVISOR = { userId: "usr_advisor", role: "staff", staffRole: "client_advisor" };
const SPECIALIST = { userId: "usr_spec", role: "staff", staffRole: "specialist" };
const CLIENT = { userId: "usr_client", role: "client", staffRole: null };
const T0 = new Date("2026-10-10T10:00:00.000Z");
const T1 = new Date("2026-10-10T11:00:00.000Z");

function history(overrides: Partial<LaxStaffAccessHistoryEntry> = {}): LaxStaffAccessHistoryEntry {
  return {
    eventId: 1,
    at: T1,
    product: "shop",
    action: "granted",
    role: "broker",
    actorSubjectId: SUPER.userId,
    invitationId: null,
    ...overrides,
  };
}

function setup() {
  const access = {
    listForSubjects: vi.fn(async () => [
      { subjectId: "usr_a", product: "shop" as const, role: "finance", updatedAt: T0 },
      { subjectId: "usr_a", product: "bid" as const, role: "specialist", updatedAt: T0 },
    ]),
    history: vi.fn(async () => [history()]),
    requestGrant: vi.fn(async () => {}),
    requestRevoke: vi.fn(async () => {}),
  };
  const users = {
    getById: vi.fn(async (id: string) => (id === "missing" ? null : ({ id } as never))),
    getByIds: vi.fn(async () => [{ id: SUPER.userId, name: "Sam Super", email: "s@lax.test" }]),
  };
  const identity = {
    readSecuritySummaries: vi.fn(
      async () => new Map([["usr_a", { twoFactorEnabled: true, lastSignInAt: T1 }]]),
    ),
  };
  const service = new StaffAccessAdminService({
    access,
    users: users as never,
    identity,
  });
  return { service, access, users, identity };
}

describe("StaffAccessAdminService", () => {
  it("summarises platforms in catalogue order with Identity security data", async () => {
    const { service } = setup();

    const result = await service.summaries(ADVISOR, ["usr_a", "usr_b", "usr_a"]);

    expect(result._unsafeUnwrap()).toEqual([
      {
        subjectId: "usr_a",
        platforms: [
          { product: "bid", role: "specialist" },
          { product: "shop", role: "finance" },
        ],
        twoFactorEnabled: true,
        lastSignInAt: T1.toISOString(),
      },
      { subjectId: "usr_b", platforms: [], twoFactorEnabled: null, lastSignInAt: null },
    ]);
  });

  it("still lists roles when Identity is unavailable", async () => {
    const { service, identity } = setup();
    identity.readSecuritySummaries.mockRejectedValueOnce(new Error("down"));

    const [row] = (await service.summaries(ADVISOR, ["usr_a"]))._unsafeUnwrap();

    expect(row).toMatchObject({ twoFactorEnabled: null, lastSignInAt: null });
    expect(row?.platforms).toHaveLength(2);
  });

  it("refuses readers without the users directory", async () => {
    const { service } = setup();

    expect((await service.summaries(SPECIALIST, ["usr_a"]))._unsafeUnwrapErr().status).toBe(403);
    expect((await service.detail(CLIENT, "usr_a"))._unsafeUnwrapErr().status).toBe(403);
  });

  it("shows a Shop grant as pending until Shop applies it, with actor names", async () => {
    const { service } = setup();

    const detail = (await service.detail(ADVISOR, "usr_a"))._unsafeUnwrap();

    expect(detail.platforms.find((p) => p.product === "shop")).toEqual({
      product: "shop",
      role: "finance",
      updatedAt: T0.toISOString(),
      pending: { action: "granted", role: "broker", requestedAt: T1.toISOString() },
    });
    expect(detail.history[0]).toMatchObject({ actorName: "Sam Super", viaInvitation: false });
  });

  it("only lets super admins request Shop changes, with a known role", async () => {
    const { service, access } = setup();

    expect(
      (await service.setRemoteRole(ADVISOR, "usr_a", "shop", "broker"))._unsafeUnwrapErr(),
    ).toEqual({ status: 403, message: "forbidden" });
    expect(
      (await service.setRemoteRole(SUPER, "usr_a", "shop", "auctioneer"))._unsafeUnwrapErr(),
    ).toEqual({ status: 400, message: "unknown_shop_role" });
    expect(
      (await service.setRemoteRole(SUPER, "missing", "shop", "broker"))._unsafeUnwrapErr().status,
    ).toBe(404);

    const ok = await service.setRemoteRole(SUPER, "usr_a", "shop", "broker");

    expect(ok.isOk()).toBe(true);
    expect(access.requestGrant).toHaveBeenCalledTimes(1);
    expect(access.requestGrant).toHaveBeenCalledWith({
      subjectId: "usr_a",
      product: "shop",
      role: "broker",
      actorSubjectId: SUPER.userId,
    });
  });

  it("does not let an admin revoke their own Shop access", async () => {
    const { service, access } = setup();

    const result = await service.revokeRemote(SUPER, SUPER.userId, "shop");

    expect(result._unsafeUnwrapErr()).toEqual({ status: 400, message: "cannot_revoke_self" });
    expect(access.requestRevoke).not.toHaveBeenCalled();
  });
});

describe("platformView", () => {
  const entry = { subjectId: "usr_a", product: "shop" as const, role: "broker", updatedAt: T0 };

  it("is settled when the product wrote its role after the latest request", () => {
    expect(platformView("shop", { ...entry, updatedAt: T1 }, history({ at: T0 })).pending).toBe(
      null,
    );
  });

  it("is settled when the product already reflects the request", () => {
    expect(platformView("shop", entry, history({ role: "broker" })).pending).toBe(null);
    expect(platformView("shop", null, history({ action: "revoked", role: null })).pending).toBe(
      null,
    );
  });

  it("is pending for a revoke Shop has not applied yet", () => {
    expect(platformView("shop", entry, history({ action: "revoked", role: null })).pending).toEqual(
      { action: "revoked", role: null, requestedAt: T1.toISOString() },
    );
  });
});
