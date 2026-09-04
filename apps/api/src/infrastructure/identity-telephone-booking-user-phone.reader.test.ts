import { describe, expect, it, vi } from "vitest";
import { IdentityTelephoneBookingUserPhoneReader } from "./identity-telephone-booking-user-phone.reader.js";

describe("IdentityTelephoneBookingUserPhoneReader", () => {
  it("returns phone and verification from the same Identity security response", async () => {
    const readSecurityStatus = vi.fn().mockResolvedValue({
      twoFactorEnabled: false,
      phoneNumber: "+442012345678",
      phoneNumberVerified: true,
      pendingNewEmail: null,
      emailChangeExpiresAt: null,
    });
    const reader = new IdentityTelephoneBookingUserPhoneReader({ readSecurityStatus });

    await expect(reader.findByUserId("user-1")).resolves.toEqual({
      phoneNumber: "+442012345678",
      phoneNumberVerified: true,
    });
    expect(readSecurityStatus).toHaveBeenCalledWith("user-1");
  });

  it("returns null when Identity has no subject security response", async () => {
    const reader = new IdentityTelephoneBookingUserPhoneReader({
      readSecurityStatus: vi.fn().mockResolvedValue(null),
    });

    await expect(reader.findByUserId("missing")).resolves.toBeNull();
  });
});
