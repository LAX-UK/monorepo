import { describe, expect, it, vi } from "vitest";
import { PASSKEY_COPY } from "../passkey-copy.js";
import { createPasskeyAdd, nameProblem, syncNoteFor } from "./passkey-add.js";
import type { PasskeyRuntime } from "./passkey-ceremony.js";
import type { PasskeyFailure } from "./passkey-outcome.js";

const COPY = PASSKEY_COPY.add;

function setup(
  options: {
    supports?: boolean;
    failure?: PasskeyFailure | "ok";
    rename?: () => Promise<boolean>;
    name?: string;
    synced?: boolean;
  } = {},
) {
  const failure = options.failure ?? "ok";
  const bodies: Record<string, [number, unknown]> = {
    limit: [422, { code: "passkey_limit" }],
    not_verified: [403, { code: "passkey_user_verification_required" }],
    rate_limited: [429, {}],
    expired: [403, { code: "passkey_enrolment_not_allowed" }],
    unavailable: [500, {}],
  };
  const runtime: PasskeyRuntime = {
    supportsPasskeys: () => options.supports ?? true,
    supportsAutofill: async () => false,
    authenticate: vi.fn(),
    register: async () => {
      if (failure === "cancelled") throw Object.assign(new Error("x"), { name: "NotAllowedError" });
      if (failure === "already_on_device") {
        throw Object.assign(new Error("x"), { code: "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED" });
      }
      return { id: "cred", response: {} };
    },
    fetch: (async (_url: string, init?: RequestInit) => {
      if (init?.method !== "POST") return Response.json({ challenge: "c" });
      const refused = bodies[failure];
      if (refused) return Response.json(refused[1], { status: refused[0] });
      return Response.json({
        passkey: {
          id: "pk-1",
          name: options.name ?? "iCloud Keychain",
          synced: options.synced ?? true,
          kind: "platform",
        },
      });
    }) as unknown as typeof fetch,
  };
  const view = {
    busy: vi.fn(),
    quietNote: vi.fn(),
    summary: vi.fn(),
    showUnsupported: vi.fn(),
    showSaved: vi.fn(),
    nameError: vi.fn(),
    saving: vi.fn(),
    leave: vi.fn(),
  };
  const rename = vi.fn(options.rename ?? (async () => true));
  return { controller: createPasskeyAdd({ runtime, view, rename }), view, rename };
}

describe("add a passkey page", () => {
  it("explains an unsupported browser instead of offering the button", () => {
    const { controller, view } = setup({ supports: false });
    controller.start();
    expect(view.showUnsupported).toHaveBeenCalled();
  });

  it("offers the button where passkeys work", () => {
    const { controller, view } = setup();
    controller.start();
    expect(view.showUnsupported).not.toHaveBeenCalled();
  });

  it("moves to naming once the device has answered, saying where the passkey is kept", async () => {
    const { controller, view } = setup();
    await controller.create();
    expect(view.busy.mock.calls).toEqual([[true], [false]]);
    expect(view.showSaved).toHaveBeenCalledWith(
      expect.objectContaining({ id: "pk-1", name: "iCloud Keychain" }),
      COPY.synced.apple,
    );
  });

  it("puts a closed prompt in the quiet line", async () => {
    const { controller, view } = setup({ failure: "cancelled" });
    await controller.create();
    expect(view.quietNote).toHaveBeenLastCalledWith(COPY.cancelled);
    expect(view.summary).toHaveBeenLastCalledWith(null);
    expect(view.showSaved).not.toHaveBeenCalled();
  });

  it.each([
    ["already_on_device", COPY.alreadyOnDevice],
    ["not_verified", COPY.notVerified],
    ["limit", COPY.limit],
    ["rate_limited", COPY.rateLimited],
    ["unavailable", COPY.unavailable],
  ] as const)("puts %s in the summary at the top", async (failure, message) => {
    const { controller, view } = setup({ failure });
    await controller.create();
    expect(view.summary).toHaveBeenLastCalledWith(message);
    expect(view.showSaved).not.toHaveBeenCalled();
  });

  it("tells a spent permission from a failure: the link has expired", async () => {
    const { controller, view } = setup({ failure: "expired" });
    await controller.create();
    expect(view.summary).toHaveBeenLastCalledWith(`${COPY.expiredTitle}. ${COPY.expired}`);
  });

  describe("naming", () => {
    it("keeps the suggested name without a request and goes back", async () => {
      const { controller, view, rename } = setup();
      await controller.create();
      await controller.save("  iCloud Keychain ");
      expect(rename).not.toHaveBeenCalled();
      expect(view.leave).toHaveBeenCalled();
    });

    it("renames to the chosen name and goes back", async () => {
      const { controller, view, rename } = setup();
      await controller.create();
      await controller.save("Work laptop");
      expect(rename).toHaveBeenCalledWith("pk-1", "Work laptop");
      expect(view.leave).toHaveBeenCalled();
    });

    it("asks for a name when the field is empty, and makes no request", async () => {
      const { controller, view, rename } = setup();
      await controller.create();
      await controller.save("   ");
      expect(view.nameError).toHaveBeenLastCalledWith(COPY.nameRequired);
      expect(rename).not.toHaveBeenCalled();
      expect(view.leave).not.toHaveBeenCalled();
    });

    it("refuses a name over forty characters", async () => {
      const { controller, view } = setup();
      await controller.create();
      await controller.save("x".repeat(41));
      expect(view.nameError).toHaveBeenLastCalledWith(COPY.nameTooLong);
    });

    it("says so when the name could not be saved, and does not pretend the passkey is lost", async () => {
      const { controller, view } = setup({ rename: async () => false });
      await controller.create();
      await controller.save("Work laptop");
      expect(view.summary).toHaveBeenLastCalledWith(COPY.renameFailed);
      expect(view.leave).not.toHaveBeenCalled();
      expect(view.saving.mock.calls).toEqual([[true], [false]]);
    });

    it("does nothing before a passkey exists", async () => {
      const { controller, view, rename } = setup();
      await controller.save("Work laptop");
      expect(rename).not.toHaveBeenCalled();
      expect(view.leave).not.toHaveBeenCalled();
    });
  });
});

describe("syncNoteFor", () => {
  it.each([
    [{ name: "iCloud Keychain", synced: true, kind: "platform" }, COPY.synced.apple],
    [{ name: "Google Password Manager", synced: true, kind: "platform" }, COPY.synced.google],
    [{ name: "1Password", synced: true, kind: "platform" }, COPY.synced.manager],
    [{ name: "Windows Hello", synced: false, kind: "platform" }, COPY.synced.deviceOnly],
    [{ name: "Security key", synced: true, kind: "security_key" }, COPY.synced.deviceOnly],
  ] as const)("describes %j", (passkey, expected) => {
    expect(syncNoteFor(passkey)).toBe(expected);
  });
});

describe("nameProblem", () => {
  it("accepts a plain name and refuses empty, long and control characters", () => {
    expect(nameProblem("Work laptop")).toBeNull();
    expect(nameProblem("")).toBe(COPY.nameRequired);
    expect(nameProblem("x".repeat(41))).toBe(COPY.nameTooLong);
    expect(nameProblem("a\nb")).toBe(COPY.nameRequired);
  });
});
