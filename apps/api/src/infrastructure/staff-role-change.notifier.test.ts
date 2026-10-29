import type { IEmailService } from "@auction/email";
import type { StaffNoticeRecipient } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import type { ChangedStaffRole } from "../services/staff/staff-role-notices.js";
import { StaffRoleChangeNotifier } from "./staff-role-change.notifier.js";

const NOW = new Date("2026-10-29T12:00:00.000Z");
const person = (id: string, name: string): StaffNoticeRecipient => ({
  id,
  name,
  email: `${id}@lax.test`,
  firstName: name.split(" ")[0] ?? null,
});
const ADA = person("ada", "Ada Lovelace");
const GRACE = person("grace", "Grace Hopper");
const ALAN = person("alan", "Alan Turing");

const given: ChangedStaffRole = {
  product: "shop",
  subjectId: "ada",
  actorSubjectId: "alan",
  role: "editor",
  change: "given",
  // Ends when 1 December starts in London, so the last day is 30 November.
  endsAt: new Date("2026-12-01T00:00:00.000Z"),
  reason: "Covers the autumn exhibitions",
  requestedAt: NOW,
};

function setup(laxAdmins: StaffNoticeRecipient[]) {
  const recipients = {
    findByIds: async (ids: readonly string[]) =>
      [ADA, GRACE, ALAN].filter((p) => ids.includes(p.id)),
  };
  const administrators = { listAdministrators: vi.fn(async () => laxAdmins) };
  const dispatch = vi.fn().mockResolvedValue(undefined);
  const enqueue = vi.fn().mockResolvedValue({ outboxId: "o" });
  const notifier = new StaffRoleChangeNotifier(
    recipients,
    administrators,
    { dispatch },
    { enqueue } as unknown as IEmailService,
    "https://lax.bid",
  );
  return { notifier, administrators, dispatch, enqueue };
}

describe("StaffRoleChangeNotifier", () => {
  it("tells the person and each LAX Admin administrator, in the product and by email", async () => {
    const { notifier, administrators, dispatch, enqueue } = setup([GRACE, ALAN]);

    await notifier.notifyChanged(given, NOW);

    expect(administrators.listAdministrators).toHaveBeenCalledWith("shop", NOW);
    expect(dispatch).toHaveBeenCalledWith("ada", {
      type: "staff_role_changed",
      title: "You have the Editor role on LAX Admin",
      message:
        "You were given the Editor role on LAX Admin until 30 November 2026. It applies the next time you load a page.",
    });
    expect(dispatch).toHaveBeenCalledWith("grace", {
      type: "staff_role_changed_admin",
      title: "A staff role was given",
      message: "Ada Lovelace was given the Editor role on LAX Admin until 30 November 2026.",
    });
    expect(dispatch).toHaveBeenCalledTimes(3);
    const vars = new Map(enqueue.mock.calls.map(([c]) => [c.to, c.vars]));
    expect(vars.get("ada@lax.test")).toMatchObject({
      recipient: "person",
      changedByName: "Alan Turing",
      endsOnDisplay: "30 November 2026",
      adminStaffAccessUrl: null,
    });
    expect(vars.get("grace@lax.test")).toMatchObject({
      recipient: "administrator",
      adminStaffAccessUrl: "https://lax.bid/admin/staff/access",
    });
  });

  it("keys email per change and recipient, so a retry sends nothing twice", async () => {
    const { notifier, enqueue } = setup([GRACE]);
    await notifier.notifyChanged(given, NOW);
    await notifier.notifyChanged(given, NOW);
    const keys = enqueue.mock.calls.map(([c]) => c.idempotencyKey);
    expect(new Set(keys).size).toBe(2);
  });

  it("gives an administrator whose own role changed only the personal notice", async () => {
    const { notifier, dispatch } = setup([ADA, GRACE]);
    await notifier.notifyChanged({ ...given, change: "removed", endsAt: null }, NOW);
    const toAda = dispatch.mock.calls.filter(([id]) => id === "ada");
    expect(toAda).toHaveLength(1);
    expect(toAda[0]?.[1]).toMatchObject({
      type: "staff_role_changed",
      title: "Your Editor role on LAX Admin was removed",
    });
  });
});
