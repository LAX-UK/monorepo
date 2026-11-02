import type { EmailEnqueueInput } from "@auction/auth";
import { describe, expect, it, vi } from "vitest";
import { formatLondonTime } from "./format-london-time.js";
import {
  KNOWN_DEVICE_WINDOW_MS,
  type KnownDeviceStore,
  NEW_DEVICE_NOTICES_PER_DAY,
  fingerprintDevice,
  isNewDevice,
} from "./known-device.js";
import { SecurityNoticeService } from "./security-notice.service.js";

const USER = "11111111-1111-4111-8111-111111111111";
const AT = new Date("2026-10-23T13:05:00.000Z");
const CHROME_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36";
const SECURE_URL = "https://account.lax.bid/account/security";
const CANCEL_URL = "https://account.lax.bid/account/security/delete";

function setup(
  options: { seen?: Awaited<ReturnType<KnownDeviceStore["touch"]>>; sentToday?: number } = {},
) {
  const email = {
    enqueue: vi.fn<(input: EmailEnqueueInput) => Promise<{ outboxId: string }>>(async () => ({
      outboxId: "o1",
    })),
  };
  const devices = {
    touch: vi.fn(async () => options.seen ?? { previousLastSeenAt: null, hadOtherDevices: true }),
    countNoticesSince: vi.fn(async () => options.sentToday ?? 0),
    markNotified: vi.fn(async () => undefined),
  };
  const subjects = {
    findById: vi.fn(async () => ({ id: USER, email: "ada@example.com", name: "Ada" })),
  };
  const log = { warn: vi.fn(), error: vi.fn() };
  const service = new SecurityNoticeService(
    {
      subjects: subjects as never,
      email,
      devices,
      secureAccountUrl: SECURE_URL,
      cancelDeletionUrl: CANCEL_URL,
      log,
    },
    () => AT,
  );
  return { service, email, devices, subjects, log };
}

describe("formatLondonTime", () => {
  it("names the zone and follows British Summer Time", () => {
    expect(formatLondonTime(new Date("2026-10-23T13:05:00.000Z"))).toBe(
      "23 October 2026 at 14:05 BST",
    );
  });

  it("uses GMT in winter", () => {
    expect(formatLondonTime(new Date("2026-12-01T13:05:00.000Z"))).toBe(
      "1 December 2026 at 13:05 GMT",
    );
  });
});

describe("SecurityNoticeService account deletion", () => {
  it("tells the person the date the data is erased and where to cancel", async () => {
    const { service, email } = setup();
    await service.notify({
      kind: "account_deletion_requested",
      userId: USER,
      at: AT,
      effectiveAt: new Date("2026-11-22T13:05:00.000Z"),
      userAgent: CHROME_MAC,
    });
    expect(email.enqueue).toHaveBeenCalledTimes(1);
    const call = email.enqueue.mock.calls[0]?.[0];
    expect(call).toMatchObject({
      template: "account-deletion-requested",
      to: "ada@example.com",
      category: "auth",
      vars: {
        effectiveDateDisplay: "22 November 2026",
        graceDays: 30,
        cancelDeletionUrl: CANCEL_URL,
        secureAccountUrl: SECURE_URL,
      },
    });
  });

  it("confirms the cancellation", async () => {
    const { service, email } = setup();
    await service.notify({ kind: "account_deletion_cancelled", userId: USER, at: AT });
    expect(email.enqueue.mock.calls[0]?.[0]).toMatchObject({
      template: "account-deletion-cancelled",
      to: "ada@example.com",
    });
  });
});

describe("SecurityNoticeService", () => {
  it.each([
    ["password_changed", "password-changed"],
    ["two_factor_enabled", "2fa-enabled"],
    ["two_factor_disabled", "2fa-disabled"],
    ["two_factor_reset_by_support", "2fa-reset-by-support"],
    ["backup_codes_regenerated", "backup-codes-regenerated"],
  ] as const)(
    "sends %s to the account's email with what, when, device and the secure link",
    async (kind, template) => {
      const { service, email } = setup();

      await service.notify({ kind, userId: USER, at: AT, userAgent: CHROME_MAC });

      expect(email.enqueue).toHaveBeenCalledWith({
        template,
        to: "ada@example.com",
        userId: USER,
        category: "auth",
        vars: {
          userName: "Ada",
          whenDisplay: "23 October 2026 at 14:05 BST",
          deviceLabel: "Chrome on macOS",
          secureAccountUrl: SECURE_URL,
        },
      });
    },
  );

  it("leaves the device out when the request had no user agent", async () => {
    const { service, email } = setup();

    await service.notify({ kind: "two_factor_enabled", userId: USER, at: AT });

    expect(email.enqueue.mock.calls[0]?.[0].vars).toMatchObject({ deviceLabel: null });
  });

  it("masks the phone number", async () => {
    const { service, email } = setup();

    await service.notify({ kind: "phone_verified", userId: USER, at: AT, phone: "+447700900123" });

    const input = email.enqueue.mock.calls[0]?.[0];
    expect(input?.template).toBe("phone-verified");
    expect(JSON.stringify(input)).not.toContain("7700900123");
    expect(input?.vars.maskedPhone).toBe("+44******23");
  });

  it("tells both the old and the new address about an email change", async () => {
    const { service, email } = setup();

    await service.notify({
      kind: "email_changed",
      userId: USER,
      at: AT,
      previousEmail: "old@example.com",
      newEmail: "new@example.com",
    });

    expect(
      email.enqueue.mock.calls.map(([input]) => [input.to, input.template, input.vars.recipient]),
    ).toEqual([
      ["old@example.com", "email-changed", "previous"],
      ["new@example.com", "email-changed", "new"],
    ]);
  });

  it("never throws: a failed enqueue is logged and swallowed", async () => {
    const { service, email, log } = setup();
    email.enqueue.mockRejectedValue(new Error("outbox down"));

    await expect(
      service.notify({ kind: "password_changed", userId: USER, at: AT }),
    ).resolves.toBeUndefined();

    expect(log.error).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "password_changed",
        userId: USER,
        errorMessage: "outbox down",
      }),
      "security_notice_failed",
    );
  });

  it("sends nothing for a person who no longer exists", async () => {
    const { service, email, subjects } = setup();
    subjects.findById.mockResolvedValue(null as never);

    await service.notify({ kind: "password_changed", userId: USER, at: AT });

    expect(email.enqueue).not.toHaveBeenCalled();
  });
});

describe("new-device sign-in notices", () => {
  const signIn = {
    kind: "sign_in",
    userId: USER,
    at: AT,
    userAgent: CHROME_MAC,
    region: "GB",
  } as const;

  it("emails a device the person has not used before", async () => {
    const { service, email, devices } = setup({
      seen: { previousLastSeenAt: null, hadOtherDevices: true },
    });

    await service.notify(signIn);

    expect(email.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ template: "new-device-login", to: "ada@example.com" }),
    );
    expect(devices.markNotified).toHaveBeenCalledWith({
      userId: USER,
      fingerprint: fingerprintDevice(signIn),
      at: AT,
    });
  });

  it("does not email a person's very first sign-in", async () => {
    const { service, email } = setup({
      seen: { previousLastSeenAt: null, hadOtherDevices: false },
    });

    await service.notify(signIn);

    expect(email.enqueue).not.toHaveBeenCalled();
  });

  it("does not email a device seen within the last 90 days", async () => {
    const recent = new Date(AT.getTime() - KNOWN_DEVICE_WINDOW_MS + 60_000);
    const { service, email } = setup({
      seen: { previousLastSeenAt: recent, hadOtherDevices: true },
    });

    await service.notify(signIn);

    expect(email.enqueue).not.toHaveBeenCalled();
  });

  it("emails a device last seen more than 90 days ago", async () => {
    const stale = new Date(AT.getTime() - KNOWN_DEVICE_WINDOW_MS - 60_000);
    const { service, email } = setup({
      seen: { previousLastSeenAt: stale, hadOtherDevices: true },
    });

    await service.notify(signIn);

    expect(email.enqueue).toHaveBeenCalledTimes(1);
  });

  it("rate-limits the emails per person", async () => {
    const { service, email, devices } = setup({ sentToday: NEW_DEVICE_NOTICES_PER_DAY });

    await service.notify(signIn);

    expect(email.enqueue).not.toHaveBeenCalled();
    expect(devices.markNotified).not.toHaveBeenCalled();
  });

  it("does not mark the device as notified when the email could not be queued", async () => {
    const { service, email, devices } = setup();
    email.enqueue.mockRejectedValue(new Error("outbox down"));

    await service.notify(signIn);

    expect(devices.markNotified).not.toHaveBeenCalled();
  });
});

describe("fingerprintDevice", () => {
  const base = { userId: USER, userAgent: CHROME_MAC, region: "GB" };

  it("is stable across a browser version update", () => {
    const updated = CHROME_MAC.replace("130.0.0.0", "131.0.6778.86");
    expect(fingerprintDevice({ ...base, userAgent: updated })).toBe(fingerprintDevice(base));
  });

  it("differs by browser, system, region and person", () => {
    const fingerprints = new Set([
      fingerprintDevice(base),
      fingerprintDevice({
        ...base,
        userAgent: "Mozilla/5.0 (iPhone) AppleWebKit Version/17 Safari/605.1",
      }),
      fingerprintDevice({ ...base, region: "FR" }),
      fingerprintDevice({ ...base, userId: "22222222-2222-4222-8222-222222222222" }),
    ]);
    expect(fingerprints.size).toBe(4);
  });

  it("treats region case-insensitively and holds neither the user agent nor the region", () => {
    expect(fingerprintDevice({ ...base, region: "gb" })).toBe(fingerprintDevice(base));
    expect(fingerprintDevice(base)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("isNewDevice", () => {
  it("is false exactly at the 90 day boundary and true just after", () => {
    const at = AT;
    const boundary = new Date(at.getTime() - KNOWN_DEVICE_WINDOW_MS);
    expect(isNewDevice({ previousLastSeenAt: boundary, hadOtherDevices: true }, at)).toBe(false);
    expect(
      isNewDevice(
        { previousLastSeenAt: new Date(boundary.getTime() - 1), hadOtherDevices: true },
        at,
      ),
    ).toBe(true);
  });
});
