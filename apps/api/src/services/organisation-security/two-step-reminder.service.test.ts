import type { LegalEntityMemberRole } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { TwoStepReminderService } from "./two-step-reminder.service.js";

const ENTITY = "00000000-0000-4000-8000-000000000001";

const actor = (role: LegalEntityMemberRole, isImpersonation?: boolean) => ({
  userId: "maya",
  legalEntityId: ENTITY,
  role,
  isImpersonation,
});

const person = (id: string, name: string) => ({
  user: { id, name, email: `${id}@northbank.test`, image: null },
});

function setup(input: { statuses?: Record<string, boolean>; claimed?: string[] } = {}) {
  const claimed = new Set(input.claimed ?? []);
  const claim = vi.fn(async (key: string) => {
    if (claimed.has(key)) return false;
    claimed.add(key);
    return true;
  });
  const enqueue = vi.fn(async () => ({ outboxId: "o" }));
  const publish = vi.fn(async () => undefined);
  const statuses = input.statuses ?? { maya: false, tom: false, sam: true, lena: false };
  const service = new TwoStepReminderService({
    members: {
      listMembersWithUsers: vi.fn(
        async () =>
          [
            person("maya", "Maya Okafor"),
            person("tom", "Tom Whitfield"),
            person("sam", "Sam Kerr"),
            person("lena", "Lena Park"),
          ] as never,
      ),
    },
    identity: {
      readTwoFactorStatuses: vi.fn(async () => new Map(Object.entries(statuses))),
      readTwoFactorPolicy: vi.fn(async () => ({
        policy: { required: true, setBySubjectId: null, setAt: null },
        coverage: { members: 4, enrolled: 1 },
      })),
    },
    cooldowns: { claim },
    email: { enqueue },
    events: { publish, withTx: vi.fn() } as never,
    organisations: { nameOf: async () => "Northbank Gallery" },
    securityUrl: "https://lax.bid/dashboard/settings/security",
  });
  return { service, enqueue, publish, claim };
}

describe("TwoStepReminderService", () => {
  it.each(["owner", "admin"] as const)(
    "emails everyone without two-step but %s, and records how many",
    async (role) => {
      const { service, enqueue, publish } = setup();
      expect((await service.remind(actor(role)))._unsafeUnwrap()).toEqual({ reminded: 2 });
      expect(enqueue.mock.calls.map((call) => (call as unknown as [{ to: string }])[0].to)).toEqual(
        ["tom@northbank.test", "lena@northbank.test"],
      );
      expect(enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          template: "two-step-reminder-notice",
          vars: {
            recipientFirstName: "Tom",
            entityName: "Northbank Gallery",
            senderName: "Maya Okafor",
            required: true,
            securityUrl: "https://lax.bid/dashboard/settings/security",
          },
        }),
      );
      expect(publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "legal_entity.two_step_reminder_sent",
          payload: { recipient_count: 2 },
          actingLegalEntityId: ENTITY,
        }),
      );
    },
  );

  it("refuses a second send the same day", async () => {
    const { service, enqueue } = setup({ claimed: [`two-step-reminder:org:${ENTITY}`] });
    expect((await service.remind(actor("owner")))._unsafeUnwrapErr()).toMatchObject({
      code: "sent_recently",
      status: 429,
    });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("skips a member already reminded today", async () => {
    const { service, enqueue } = setup({ claimed: [`two-step-reminder:${ENTITY}:tom`] });
    expect((await service.remind(actor("owner")))._unsafeUnwrap()).toEqual({ reminded: 1 });
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it("says there is nobody to remind, without using the day's send", async () => {
    const { service, claim } = setup({
      statuses: { maya: false, tom: true, sam: true, lena: true },
    });
    expect((await service.remind(actor("owner")))._unsafeUnwrapErr().code).toBe("nobody_to_remind");
    expect(claim).not.toHaveBeenCalled();
  });

  it.each([
    ["finance", false],
    ["viewer", false],
    ["owner", true],
  ] as const)("refuses %s (impersonating: %s)", async (role, impersonating) => {
    const { service, enqueue } = setup();
    expect((await service.remind(actor(role, impersonating)))._unsafeUnwrapErr().status).toBe(403);
    expect(enqueue).not.toHaveBeenCalled();
  });
});
