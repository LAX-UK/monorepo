import { ACCOUNT_CONTACT_ERRORS } from "@auction/identity-contracts";
import { describe, expect, it } from "vitest";
import {
  contactRejectionMessage,
  normalisePhoneInput,
  phoneEntryLabel,
  resolveProfileContact,
} from "./account-contact.vm";
import { buildEmailChangeConfirmationVm } from "./email-change-confirmation.vm";

const OVERVIEW = {
  email: "token@example.com",
  emailVerified: false,
  phone: "+441111111111",
  phoneVerified: true,
};

describe("resolveProfileContact", () => {
  it("prefers the live answer, which knows about a change made since sign-in", () => {
    expect(
      resolveProfileContact(OVERVIEW, {
        email: "live@example.com",
        emailVerified: true,
        pendingEmail: "next@example.com",
        phone: "+442222222222",
        phoneVerified: true,
      }),
    ).toEqual({
      email: "live@example.com",
      emailVerified: true,
      pendingEmail: "next@example.com",
      phone: "+442222222222",
      phoneVerified: true,
    });
  });

  it("never reports an absent phone as verified", () => {
    expect(
      resolveProfileContact(OVERVIEW, {
        email: "live@example.com",
        emailVerified: true,
        pendingEmail: null,
        phone: null,
        phoneVerified: true,
      }).phoneVerified,
    ).toBe(false);
  });

  it("falls back to the sign-in values, with no pending change, when the issuer is silent", () => {
    expect(resolveProfileContact(OVERVIEW, null)).toEqual({ ...OVERVIEW, pendingEmail: null });
  });
});

describe("normalisePhoneInput", () => {
  it.each([
    ["+44 7700 900123", "+447700900123"],
    ["+44 (0) 7700-900-123", "+447700900123"],
    ["0044 7700 900123", "+447700900123"],
    ["+1.415.555.0100", "+14155550100"],
  ])("turns %j into %s", (raw, expected) => {
    expect(normalisePhoneInput(raw)).toBe(expected);
  });

  it.each(["", "07700 900123", "+0 123 456 7890", "+44 77OO 900123", "+44", "+1234567890123456"])(
    "refuses %j rather than guessing a country",
    (raw) => {
      expect(normalisePhoneInput(raw)).toBeNull();
    },
  );
});

describe("phoneEntryLabel", () => {
  it("offers the action that fits what is on file", () => {
    expect(phoneEntryLabel(null, false)).toBe("Add phone number");
    expect(phoneEntryLabel("+447700900123", false)).toBe("Verify phone number");
    expect(phoneEntryLabel("+447700900123", true)).toBe("Change phone number");
  });
});

describe("contactRejectionMessage", () => {
  it.each(ACCOUNT_CONTACT_ERRORS)("has plain-language copy for %s", (reason) => {
    const message = contactRejectionMessage(reason);
    expect(message.length).toBeGreaterThan(10);
    expect(message).toMatch(/[.]$/);
    expect(message).not.toContain("_");
  });
});

describe("buildEmailChangeConfirmationVm", () => {
  it("tells the person to sign in again once the address has switched", () => {
    const vm = buildEmailChangeConfirmationVm({ completed: true, confirmedFor: "new" });
    expect(vm.signInAgain).toBe(true);
    expect(vm.body).toMatch(/signed you out/);
  });

  it.each([
    ["old", "your new address"],
    ["new", "your current address"],
  ] as const)("after the %s inbox, points at the other one", (confirmedFor, other) => {
    const vm = buildEmailChangeConfirmationVm({ completed: false, confirmedFor });
    expect(vm.signInAgain).toBe(false);
    expect(vm.body).toContain(other);
  });
});
