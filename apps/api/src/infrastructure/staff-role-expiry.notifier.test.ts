import type { IEmailService } from "@auction/email";
import type {
  IStaffNoticeRecipientReader,
  StaffNoticeRecipient,
} from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import type { EndedStaffRole } from "../services/staff/staff-role-expiry.service.js";
import { StaffRoleExpiryNotifier } from "./staff-role-expiry.notifier.js";

const NOW = new Date("2026-11-04T03:00:00.000Z");
const person = (id: string, name: string): StaffNoticeRecipient => ({
  id,
  name,
  email: `${id}@lax.test`,
  firstName: name.split(" ")[0] ?? null,
});

const ADA = person("ada", "Ada Lovelace");
const GRACE = person("grace", "Grace Hopper");
const ALAN = person("alan", "Alan Turing");

const endedRole = (userId: string, assignmentId: string): EndedStaffRole => ({
  assignmentId,
  userId,
  role: "saleroom_clerk",
  // 23:30 UTC on 3 November is already 3 November in London (GMT).
  endedAt: new Date("2026-11-03T23:30:00.000Z"),
});

function setup(admins: StaffNoticeRecipient[]) {
  const people = [ADA, GRACE, ALAN];
  const recipients: IStaffNoticeRecipientReader = {
    findByIds: async (ids) => people.filter((p) => ids.includes(p.id)),
    listActiveAdministrators: async () => admins,
  };
  const dispatch = vi.fn().mockResolvedValue(undefined);
  const enqueue = vi.fn().mockResolvedValue({ outboxId: "o" });
  const email = { enqueue } as unknown as IEmailService;
  const notifier = new StaffRoleExpiryNotifier(recipients, { dispatch }, email, "https://lax.bid");
  return { notifier, dispatch, enqueue };
}

describe("StaffRoleExpiryNotifier", () => {
  it("tells the person, and each administrator, in the product and by email", async () => {
    const { notifier, dispatch, enqueue } = setup([GRACE, ALAN]);

    await notifier.notifyEnded([endedRole("ada", "a1")], NOW);

    expect(dispatch).toHaveBeenCalledWith("ada", {
      type: "staff_role_expired",
      title: "Your Saleroom clerk role has ended",
      message:
        "Your Saleroom clerk role on Bid ended on 3 November 2026. Ask an administrator if you still need it.",
    });
    for (const admin of ["grace", "alan"]) {
      expect(dispatch).toHaveBeenCalledWith(admin, {
        type: "staff_role_expired_admin",
        title: "A staff role has ended",
        message: "Ada Lovelace's Saleroom clerk role on Bid ended on 3 November 2026.",
      });
    }
    expect(dispatch).toHaveBeenCalledTimes(3);
    expect(enqueue.mock.calls.map(([c]) => c.idempotencyKey).sort()).toEqual(
      [
        "staff-role-expired:a1:alan",
        "staff-role-expired:a1:ada",
        "staff-role-expired:a1:grace",
      ].sort(),
    );
  });

  it("links administrators to staff access and gives the person no admin link", async () => {
    const { notifier, enqueue } = setup([GRACE]);

    await notifier.notifyEnded([endedRole("ada", "a1")], NOW);

    const byTo = new Map(enqueue.mock.calls.map(([c]) => [c.to, c.vars]));
    expect(byTo.get("ada@lax.test")).toMatchObject({
      recipient: "person",
      adminStaffAccessUrl: null,
      endedOnDisplay: "3 November 2026",
    });
    expect(byTo.get("grace@lax.test")).toMatchObject({
      recipient: "administrator",
      staffName: "Ada Lovelace",
      adminStaffAccessUrl: "https://lax.bid/admin/staff/access",
    });
  });

  it("sends an administrator whose own role ended only the personal notice", async () => {
    const { notifier, dispatch } = setup([ADA, GRACE]);

    await notifier.notifyEnded([endedRole("ada", "a1")], NOW);

    const toAda = dispatch.mock.calls.filter(([id]) => id === "ada");
    expect(toAda).toHaveLength(1);
    expect(toAda[0]?.[1].type).toBe("staff_role_expired");
  });

  it("keeps going when one recipient fails", async () => {
    const { notifier, dispatch, enqueue } = setup([GRACE, ALAN]);
    dispatch.mockRejectedValueOnce(new Error("channel down"));
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(notifier.notifyEnded([endedRole("ada", "a1")], NOW)).resolves.toBeUndefined();

    expect(enqueue).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("does nothing for an empty list", async () => {
    const { notifier, dispatch } = setup([GRACE]);
    await notifier.notifyEnded([], NOW);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
