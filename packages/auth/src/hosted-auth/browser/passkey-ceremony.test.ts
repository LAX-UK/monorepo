import { describe, expect, it, vi } from "vitest";
import { type PasskeyRuntime, createPasskey, signInWithPasskey } from "./passkey-ceremony.js";

type Call = { url: string; method: string; body: unknown };

function runtime(options: {
  challenge?: () => Response;
  verify?: () => Response;
  authenticate?: () => Promise<unknown>;
  register?: () => Promise<unknown>;
}) {
  const calls: Call[] = [];
  const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({
      url,
      method: init?.method ?? "GET",
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    if (init?.method === "POST") return options.verify?.() ?? Response.json({ ok: true });
    return options.challenge?.() ?? Response.json({ challenge: "abc" });
  });
  const authenticate = vi.fn(
    options.authenticate ??
      (async () => ({ id: "cred-1", response: {}, clientExtensionResults: { secret: 1 } })),
  );
  const register = vi.fn(
    options.register ?? (async () => ({ id: "cred-2", response: {}, clientExtensionResults: {} })),
  );
  const rt: PasskeyRuntime = {
    supportsPasskeys: () => true,
    supportsAutofill: async () => true,
    authenticate,
    register,
    fetch: fetchFn as unknown as typeof fetch,
  };
  return { rt, calls, authenticate, register };
}

describe("signInWithPasskey", () => {
  it("asks for a challenge, lets the device answer, and sends the answer back with no email", async () => {
    const { rt, calls, authenticate } = runtime({});
    const result = await signInWithPasskey(rt);
    expect(result).toEqual({ ok: true, data: { ok: true } });
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      "GET /api/auth/passkey/generate-authenticate-options",
      "POST /api/auth/passkey/verify-authentication",
    ]);
    expect(authenticate).toHaveBeenCalledWith({ optionsJSON: { challenge: "abc" } });
    // What is sent back is the device's answer without its extension results, and nothing else.
    expect(calls[1]?.body).toEqual({ response: { id: "cred-1", response: {} } });
  });

  it("asks the browser to offer saved passkeys when started quietly", async () => {
    const { rt, authenticate } = runtime({});
    await signInWithPasskey(rt, { autofill: true });
    expect(authenticate).toHaveBeenCalledWith(
      expect.objectContaining({ useBrowserAutofill: true }),
    );
  });

  it("reports a closed prompt as cancelled, without calling the issuer again", async () => {
    const { rt, calls } = runtime({
      authenticate: async () => {
        throw Object.assign(new Error("x"), { name: "NotAllowedError" });
      },
    });
    expect(await signInWithPasskey(rt)).toEqual({ ok: false, failure: "cancelled" });
    expect(calls).toHaveLength(1);
  });

  it("reports a passkey the issuer does not know", async () => {
    const { rt } = runtime({
      verify: () => Response.json({ code: "PASSKEY_NOT_FOUND" }, { status: 401 }),
    });
    expect(await signInWithPasskey(rt)).toEqual({ ok: false, failure: "not_recognised" });
  });

  it("reports a device that did not check the person", async () => {
    const { rt } = runtime({
      verify: () => Response.json({ code: "passkey_user_verification_required" }, { status: 403 }),
    });
    expect(await signInWithPasskey(rt)).toEqual({ ok: false, failure: "not_verified" });
  });

  it("reports being rate limited from the challenge call", async () => {
    const { rt, authenticate } = runtime({
      challenge: () => Response.json({}, { status: 429 }),
    });
    expect(await signInWithPasskey(rt)).toEqual({ ok: false, failure: "rate_limited" });
    expect(authenticate).not.toHaveBeenCalled();
  });

  it("reports an unreachable issuer as unavailable", async () => {
    const { rt } = runtime({});
    rt.fetch = (async () => {
      throw new TypeError("network");
    }) as unknown as typeof fetch;
    expect(await signInWithPasskey(rt)).toEqual({ ok: false, failure: "unavailable" });
  });
});

describe("createPasskey", () => {
  const created = {
    passkey: { id: "pk-1", name: "iCloud Keychain", synced: true, kind: "platform" },
  };

  it("returns what the person sees of the new passkey, never the answer's key material", async () => {
    const { rt, calls } = runtime({ verify: () => Response.json(created) });
    const result = await createPasskey(rt);
    expect(result).toEqual({ ok: true, data: created.passkey });
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      "GET /api/auth/passkey/generate-register-options",
      "POST /api/auth/passkey/verify-registration",
    ]);
    expect(calls[1]?.body).toEqual({ response: { id: "cred-2", response: {} } });
  });

  it("reports a device that already holds a passkey for the account", async () => {
    const { rt } = runtime({
      register: async () => {
        throw Object.assign(new Error("x"), { code: "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED" });
      },
    });
    expect(await createPasskey(rt)).toEqual({ ok: false, failure: "already_on_device" });
  });

  it("reports a missing permission as expired", async () => {
    const { rt, authenticate, register } = runtime({
      challenge: () => Response.json({ code: "passkey_enrolment_not_allowed" }, { status: 403 }),
    });
    expect(await createPasskey(rt)).toEqual({ ok: false, failure: "expired" });
    expect(register).not.toHaveBeenCalled();
    expect(authenticate).not.toHaveBeenCalled();
  });

  it("reports the passkey limit", async () => {
    const { rt } = runtime({
      verify: () => Response.json({ code: "passkey_limit" }, { status: 422 }),
    });
    expect(await createPasskey(rt)).toEqual({ ok: false, failure: "limit" });
  });

  it("treats an answer that is not a passkey as unavailable", async () => {
    const { rt } = runtime({ verify: () => Response.json({ something: "else" }) });
    expect(await createPasskey(rt)).toEqual({ ok: false, failure: "unavailable" });
  });
});
