import { ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import { AdminTelephoneBookingApplicationService } from "./admin-telephone-booking-application.service.js";

function build(eligible: boolean) {
  const assignClerk = vi.fn(async () => ok({ id: "booking-1" }));
  const staff = {
    assertBookingBelongsToSale: vi.fn(async () => ok(undefined)),
    assignClerk,
  };
  const clerks = { canTakeTelephoneLines: vi.fn(async () => eligible) };
  const service = new AdminTelephoneBookingApplicationService(staff as never, {} as never, clerks);
  return { service, assignClerk, clerks };
}

const input = {
  saleId: "sale-1",
  bookingId: "booking-1",
  staffUserId: "staff-1",
  clerkUserId: "clerk-1",
};

describe("AdminTelephoneBookingApplicationService.assignClerk", () => {
  it("assigns a clerk who can run the saleroom", async () => {
    const { service, assignClerk } = build(true);
    const outcome = await service.assignClerk(input);
    expect(outcome.kind).toBe("ok");
    expect(assignClerk).toHaveBeenCalledOnce();
  });

  it("refuses someone who cannot take telephone lines and assigns nothing", async () => {
    const { service, assignClerk, clerks } = build(false);
    const outcome = await service.assignClerk(input);
    expect(clerks.canTakeTelephoneLines).toHaveBeenCalledWith("clerk-1");
    expect(outcome).toMatchObject({
      kind: "err",
      error: { status: 400, code: "clerk_not_eligible" },
    });
    expect(assignClerk).not.toHaveBeenCalled();
  });
});
