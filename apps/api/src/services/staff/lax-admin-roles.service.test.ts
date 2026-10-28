import type {
  LaxAdminRoleAssignmentRecord,
  LaxAdminRoleRequest,
} from "@auction/persistence/interfaces";
import type { LaxShopStaffRole } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { LaxAdminRolesService } from "./lax-admin-roles.service.js";

const NOW = new Date("2026-10-29T12:00:00Z");
const MINUTE = 60_000;

function held(role: LaxShopStaffRole, overrides: Partial<LaxAdminRoleAssignmentRecord> = {}) {
  return {
    id: `asg-${role}`,
    subjectId: "ada",
    role,
    startsAt: new Date("2026-10-01T09:00:00Z"),
    endsAt: null,
    grantedBySubjectId: "admin-1",
    grantedAt: new Date("2026-10-01T09:00:00Z"),
    reason: "Joined the team",
    endRecordedAt: null,
    grantedEventId: 10,
    endedEventId: null,
    ...overrides,
  } satisfies LaxAdminRoleAssignmentRecord;
}

function request(
  kind: "assign" | "remove",
  role: LaxShopStaffRole,
  minutesAgo: number,
): LaxAdminRoleRequest {
  return {
    eventId: 100 + minutesAgo,
    at: new Date(NOW.getTime() - minutesAgo * MINUTE),
    subjectId: "ada",
    kind,
    role,
    endsAt: null,
  };
}

function setup(
  current: LaxAdminRoleAssignmentRecord[],
  requests: LaxAdminRoleRequest[] = [],
  otherAdministrators = 1,
) {
  const roles = {
    listCurrent: vi.fn().mockResolvedValue(current),
    listAllCurrent: vi.fn(),
    countOtherActiveAdministrators: vi.fn().mockResolvedValue(otherAdministrators),
    listActiveAdministratorIds: vi.fn(),
    listRequestsSince: vi.fn().mockResolvedValue(requests),
  };
  const requestWriter = { requestGrant: vi.fn(), requestRemoval: vi.fn() };
  const notifier = { notifyChanged: vi.fn().mockResolvedValue(undefined) };
  const users = { getById: vi.fn().mockResolvedValue({ id: "ada" }) };
  const service = new LaxAdminRolesService({
    roles,
    requests: requestWriter,
    // biome-ignore lint/suspicious/noExplicitAny: the fake returns only the fields read.
    users: users as any,
    notifier,
    clock: () => NOW,
  });
  return { service, roles, requestWriter, notifier, users };
}

const change = { userId: "ada", actorUserId: "admin-1", reason: "Covers editorial" };

describe("LaxAdminRolesService.overview", () => {
  it("lists the roles held and those LAX Admin has not applied yet", async () => {
    const { service } = setup(
      [held("catalogue_editor"), held("broker")],
      [request("assign", "editor", 2), request("remove", "broker", 3)],
    );
    const overview = (await service.overview("ada"))._unsafeUnwrap();
    expect(overview.roles.map((r) => [r.role, r.pending])).toEqual([
      ["catalogue_editor", null],
      ["broker", "remove"],
      ["editor", "assign"],
    ]);
    expect(overview.otherActiveAdministrators).toBe(1);
  });

  it("drops a request once it has taken effect, and keeps only the latest per role", async () => {
    const { service } = setup(
      [held("editor")],
      [
        request("assign", "editor", 1),
        request("remove", "operations", 2),
        request("assign", "operations", 5),
      ],
    );
    const overview = (await service.overview("ada"))._unsafeUnwrap();
    expect(overview.roles.map((r) => [r.role, r.pending])).toEqual([["editor", null]]);
  });

  it("answers 404 for someone who is not a user", async () => {
    const { service, users } = setup([]);
    users.getById.mockResolvedValue(null);
    expect((await service.overview("ghost"))._unsafeUnwrapErr().status).toBe(404);
  });
});

describe("LaxAdminRolesService changes", () => {
  it("asks LAX Admin for the role and tells the people involved", async () => {
    const { service, requestWriter, notifier } = setup([held("catalogue_editor")]);
    const endsAt = new Date("2026-12-01T00:00:00Z");
    const result = await service.assign({ ...change, role: "editor", endsAt });
    expect(result.isOk()).toBe(true);
    expect(requestWriter.requestGrant).toHaveBeenCalledWith({
      subjectId: "ada",
      role: "editor",
      endsAt,
      reason: "Covers editorial",
      actorSubjectId: "admin-1",
    });
    expect(notifier.notifyChanged).toHaveBeenCalledWith(
      expect.objectContaining({ product: "shop", change: "given", role: "editor", endsAt }),
      NOW,
    );
  });

  it.each<[LaxShopStaffRole, LaxShopStaffRole]>([
    ["broker", "finance"],
    ["account_manager", "finance"],
    ["finance", "account_manager"],
    ["editor", "shop_admin"],
    ["shop_admin", "editor"],
    ["read_only", "editor"],
    ["editor", "read_only"],
  ])("refuses %s with %s before asking, with the reason", async (existing, requested) => {
    const { service, requestWriter, notifier } = setup([held(existing)]);
    const result = await service.assign({ ...change, role: requested, endsAt: null });
    expect(result._unsafeUnwrapErr()).toMatchObject({
      status: 409,
      code: "forbidden_combination",
    });
    expect(requestWriter.requestGrant).not.toHaveBeenCalled();
    expect(notifier.notifyChanged).not.toHaveBeenCalled();
  });

  it("counts a role still waiting for LAX Admin when checking a new one", async () => {
    const { service } = setup([], [request("assign", "broker", 1)]);
    const result = await service.assign({ ...change, role: "finance", endsAt: null });
    expect(result._unsafeUnwrapErr()).toMatchObject({ code: "forbidden_combination" });
  });

  it("never removes the last Administrator", async () => {
    const { service, requestWriter } = setup([held("shop_admin")], [], 0);
    const result = await service.remove({ ...change, role: "shop_admin" });
    expect(result._unsafeUnwrapErr()).toMatchObject({ status: 409, code: "last_administrator" });
    expect(requestWriter.requestRemoval).not.toHaveBeenCalled();
  });

  it("removes a role and tells the people involved", async () => {
    const { service, requestWriter, notifier } = setup([held("operations")]);
    expect((await service.remove({ ...change, role: "operations" })).isOk()).toBe(true);
    expect(requestWriter.requestRemoval).toHaveBeenCalledWith({
      subjectId: "ada",
      role: "operations",
      reason: "Covers editorial",
      actorSubjectId: "admin-1",
    });
    expect(notifier.notifyChanged).toHaveBeenCalledWith(
      expect.objectContaining({ change: "removed", role: "operations" }),
      NOW,
    );
  });

  it("refuses to remove a role the person does not hold", async () => {
    const { service } = setup([held("operations")]);
    const result = await service.remove({ ...change, role: "finance" });
    expect(result._unsafeUnwrapErr()).toMatchObject({ code: "not_assigned" });
  });
});
