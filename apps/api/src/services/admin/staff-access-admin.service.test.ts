import type { LaxStaffAccessHistoryEntry } from "@auction/persistence/interfaces";
import { type UserStaffRole, userStaffRoles } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import {
  type StaffAccessActor,
  StaffAccessAdminService,
  platformView,
} from "./staff-access-admin.service.js";

const SUPER: StaffAccessActor = {
  userId: "usr_super",
  role: "staff",
  staffRoles: ["administrator"],
};
const ADVISOR: StaffAccessActor = {
  userId: "usr_advisor",
  role: "staff",
  staffRoles: ["client_services"],
};
const SPECIALIST: StaffAccessActor = {
  userId: "usr_spec",
  role: "staff",
  staffRoles: ["specialist"],
};
const CLIENT: StaffAccessActor = { userId: "usr_client", role: "client", staffRoles: [] };
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

describe("StaffAccessAdminService tools", () => {
  it("takes the signed-in person's Bid access from their session, Shop from the directory", async () => {
    const { service } = setup();

    expect(await service.myTools(SPECIALIST)).toEqual(["bid-admin", "lax-admin"]);
    expect(await service.myTools(CLIENT)).toEqual(["lax-admin"]);
  });

  // Q7 / PRM-1: LAX Admin's "Open in Failed jobs" on a record not in Zoho is drawn only for the
  // roles Bid shows Zoho failures to. Spelt out per role so a change to the access table is seen.
  const CAN_READ_ZOHO_FAILED_JOBS: Record<UserStaffRole, boolean> = {
    administrator: true,
    sales_manager: false,
    saleroom_clerk: false,
    cataloguer: false,
    specialist: false,
    client_services: false,
    finance: false,
    fulfilment: false,
    compliance: false,
    read_only: true,
  };

  it.each(userStaffRoles)("says whether a Bid %s can read Zoho rows in Failed jobs", (role) => {
    const { service } = setup();
    const sources = service.myFailedJobSources({
      userId: "usr_x",
      role: "staff",
      staffRoles: [role],
    });
    expect(sources.includes("integrations.zoho")).toBe(CAN_READ_ZOHO_FAILED_JOBS[role]);
  });

  it("gives Finance its Xero and Books rows but not Zoho's, and a non-staff session nothing", () => {
    const { service } = setup();
    expect(
      service.myFailedJobSources({ userId: "usr_f", role: "staff", staffRoles: ["finance"] }),
    ).toEqual(["integrations.xero", "integrations.books"]);
    expect(service.myFailedJobSources({ ...CLIENT, staffRoles: ["administrator"] })).toEqual([]);
  });
});

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
