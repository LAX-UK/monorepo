import { describe, expect, it, vi } from "vitest";
import {
  AdminTwoFactorResetService,
  type TwoFactorResetActor,
} from "./admin-two-factor-reset.service.js";

const TARGET_ID = "6d1f0a52-8b3c-4e97-a4d6-2c9e7b1f5a08";
const REASON = "Customer lost phone and backup codes; identity checked by video call.";

const SUPER: TwoFactorResetActor = {
  userId: "b2e48c7a-1f09-4d35-8a6e-5d3c9f7e2b14",
  role: "staff",
  staffRoles: ["super_admin"],
};
const SUPPORT: TwoFactorResetActor = {
  userId: "c8d0f3e1-5a27-4b69-9e14-7f2a6c8d0b35",
  role: "staff",
  staffRoles: ["support_concierge"],
};
const ADVISOR: TwoFactorResetActor = {
  userId: "d9e1a4f2-6b38-4c7a-8f25-8a3b7d9e1c46",
  role: "staff",
  staffRoles: ["client_advisor"],
};
const CLIENT: TwoFactorResetActor = {
  userId: "e0f2b5a3-7c49-4d8b-9a36-9b4c8e0f2d57",
  role: "client",
  staffRoles: [],
};

function setup(target: { role: string } | null = { role: "client" }) {
  const identity = { resetTwoFactor: vi.fn().mockResolvedValue(undefined) };
  const users = { getById: vi.fn().mockResolvedValue(target) };
  const audit = { publish: vi.fn().mockResolvedValue(undefined) };
  const service = new AdminTwoFactorResetService({ identity, users: users as never, audit });
  return { service, identity, users, audit };
}

describe("AdminTwoFactorResetService", () => {
  it("records who reset whose two-step and why, then asks Identity to reset it", async () => {
    const { service, identity, audit } = setup();

    const result = await service.reset(SUPPORT, TARGET_ID, REASON);

    expect(result.isOk()).toBe(true);
    expect(audit.publish).toHaveBeenCalledWith({
      eventType: "auth.two_factor_reset_by_staff",
      aggregateType: "user",
      aggregateId: TARGET_ID,
      actorUserId: SUPPORT.userId,
      payload: { reason: REASON },
    });
    expect(identity.resetTwoFactor).toHaveBeenCalledWith(TARGET_ID);
    expect(audit.publish.mock.invocationCallOrder[0]).toBeLessThan(
      identity.resetTwoFactor.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it.each([
    ["a client advisor", ADVISOR],
    ["a customer", CLIENT],
  ])("refuses %s without touching anything", async (_label, actor) => {
    const { service, identity, audit, users } = setup();

    const result = await service.reset(actor, TARGET_ID, REASON);

    expect(result._unsafeUnwrapErr()).toEqual({ status: 403, message: "Forbidden" });
    expect(users.getById).not.toHaveBeenCalled();
    expect(audit.publish).not.toHaveBeenCalled();
    expect(identity.resetTwoFactor).not.toHaveBeenCalled();
  });

  it("reports an unknown user and records nothing", async () => {
    const { service, identity, audit } = setup(null);

    const result = await service.reset(SUPER, TARGET_ID, REASON);

    expect(result._unsafeUnwrapErr()).toEqual({ status: 404, message: "User not found" });
    expect(audit.publish).not.toHaveBeenCalled();
    expect(identity.resetTwoFactor).not.toHaveBeenCalled();
  });

  it("lets only a platform admin reset a staff account", async () => {
    const forSupport = setup({ role: "staff" });
    const denied = await forSupport.service.reset(SUPPORT, TARGET_ID, REASON);
    expect(denied._unsafeUnwrapErr().status).toBe(403);
    expect(forSupport.identity.resetTwoFactor).not.toHaveBeenCalled();

    const forSuper = setup({ role: "staff" });
    const allowed = await forSuper.service.reset(SUPER, TARGET_ID, REASON);
    expect(allowed.isOk()).toBe(true);
    expect(forSuper.identity.resetTwoFactor).toHaveBeenCalledWith(TARGET_ID);
  });

  it("does not reset when the audit entry cannot be written", async () => {
    const { service, identity, audit } = setup();
    audit.publish.mockRejectedValue(new Error("database down"));

    await expect(service.reset(SUPER, TARGET_ID, REASON)).rejects.toThrow("database down");
    expect(identity.resetTwoFactor).not.toHaveBeenCalled();
  });

  it.each([
    [
      "Identity does not know the user",
      { status: 404 },
      { status: 404, message: "User not found" },
    ],
    [
      "Identity cannot be reached",
      { kind: "network" },
      { status: 502, message: "The sign-in service could not reset it. Try again." },
    ],
  ])("reports a failure when %s", async (_label, failure, expected) => {
    const { service, identity } = setup();
    identity.resetTwoFactor.mockRejectedValue(failure);

    const result = await service.reset(SUPER, TARGET_ID, REASON);

    expect(result._unsafeUnwrapErr()).toEqual(expected);
  });
});
