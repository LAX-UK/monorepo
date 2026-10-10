import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import { StaffInvitationAcceptService } from "./staff-invitation-accept.service.js";

function makeService(email: string | null) {
  const users = {
    findById: vi.fn().mockResolvedValue(email ? { id: "user-1", email } : null),
  };
  const consumption = { acceptForExistingUser: vi.fn() };
  return { svc: new StaffInvitationAcceptService(users as never, consumption), consumption };
}

describe("StaffInvitationAcceptService", () => {
  it("accepts with the account's own email and returns the welcome path", async () => {
    const { svc, consumption } = makeService("staff@example.com");
    consumption.acceptForExistingUser.mockResolvedValue(
      ok({
        grants: [
          { product: "bid", role: "specialist" },
          { product: "shop", role: "broker" },
        ],
      }),
    );
    const res = await svc.accept("user-1", "tok");
    expect(consumption.acceptForExistingUser).toHaveBeenCalledWith(
      "tok",
      "user-1",
      "staff@example.com",
    );
    expect(res.isOk() && res.value.welcomePath).toBe("/invitations/welcome?platforms=bid,shop");
  });

  it("returns 404 when the account is unknown", async () => {
    const { svc, consumption } = makeService(null);
    const res = await svc.accept("user-1", "tok");
    expect(res.isErr() && res.error.status).toBe(404);
    expect(consumption.acceptForExistingUser).not.toHaveBeenCalled();
  });

  it("passes consumption errors through", async () => {
    const { svc, consumption } = makeService("staff@example.com");
    consumption.acceptForExistingUser.mockResolvedValue(
      err({ message: "Email does not match invitation", status: 400 }),
    );
    const res = await svc.accept("user-1", "tok");
    expect(res.isErr() && res.error.message).toBe("Email does not match invitation");
  });
});
