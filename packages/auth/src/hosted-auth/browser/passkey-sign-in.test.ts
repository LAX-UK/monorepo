import { describe, expect, it, vi } from "vitest";
import { PASSKEY_COPY } from "../passkey-copy.js";
import type { PasskeyRuntime } from "./passkey-ceremony.js";
import type { PasskeyFailure } from "./passkey-outcome.js";
import { SIGN_IN_FAILURE_LINES, createPasskeySignIn } from "./passkey-sign-in.js";

function setup(
  options: {
    supports?: boolean;
    autofill?: boolean;
    hasAutofillField?: boolean;
    results?: Array<"ok" | PasskeyFailure>;
  } = {},
) {
  const queue = [...(options.results ?? ["ok"])];
  const authenticate = vi.fn(async () => {
    const next = queue.shift() ?? "ok";
    const thrown: Partial<Record<PasskeyFailure, string>> = {
      cancelled: "NotAllowedError",
      unsupported: "NotSupportedError",
      unavailable: "SecurityError",
      already_on_device: "InvalidStateError",
    };
    // The device's own refusals are thrown by the browser; the issuer's are answered over the wire.
    if (next !== "ok" && thrown[next]) throw Object.assign(new Error("x"), { name: thrown[next] });
    return { id: "cred", response: {} };
  });
  const verifyFailures: Partial<Record<PasskeyFailure, [number, unknown]>> = {
    not_recognised: [401, { code: "PASSKEY_NOT_FOUND" }],
    not_verified: [403, { code: "passkey_user_verification_required" }],
    wrong_person: [403, { code: "passkey_wrong_person" }],
    rate_limited: [429, {}],
  };
  let last: "ok" | PasskeyFailure = "ok";
  let fetches = 0;
  const runtime: PasskeyRuntime = {
    supportsPasskeys: () => options.supports ?? true,
    supportsAutofill: async () => options.autofill ?? false,
    authenticate: async () => {
      last = queue[0] ?? "ok";
      const result = await authenticate();
      return result;
    },
    register: vi.fn(),
    fetch: (async (_url: string, init?: RequestInit) => {
      fetches += 1;
      if (init?.method !== "POST") return Response.json({ challenge: "c" });
      const failure = verifyFailures[last as PasskeyFailure];
      if (last !== "ok" && failure) return Response.json(failure[1], { status: failure[0] });
      return Response.json({ url: "/next" });
    }) as unknown as typeof fetch,
  };
  const view = {
    reveal: vi.fn(),
    busy: vi.fn(),
    quietNote: vi.fn(),
    summary: vi.fn(),
    clearStatus: vi.fn(),
    proceed: vi.fn(),
    focusButton: vi.fn(),
  };
  const controller = createPasskeySignIn({
    runtime,
    view,
    hasAutofillField: options.hasAutofillField ?? false,
  });
  return { controller, view, authenticate, fetchCalls: () => fetches };
}

describe("passkey sign-in controller", () => {
  it("shows nothing where the browser cannot use passkeys", () => {
    const { controller, view } = setup({ supports: false });
    controller.start();
    expect(view.reveal).not.toHaveBeenCalled();
  });

  it("reveals the button on load and asks the issuer for nothing", async () => {
    const { controller, view, authenticate, fetchCalls } = setup({
      autofill: true,
      hasAutofillField: true,
    });
    controller.start();
    expect(view.reveal).toHaveBeenCalled();
    expect(authenticate).not.toHaveBeenCalled();
    expect(fetchCalls()).toBe(0);
  });

  it("starts the quiet request, once, when the person first reaches for the email box", async () => {
    const { controller, view, authenticate } = setup({ autofill: true, hasAutofillField: true });
    controller.start();
    await controller.armAutofill();
    await controller.armAutofill();
    expect(authenticate).toHaveBeenCalledTimes(1);
    expect(view.proceed).toHaveBeenCalledWith({ url: "/next" });
  });

  it("starts no quiet request when the page has no autofill field", async () => {
    const { controller, authenticate } = setup({ autofill: true, hasAutofillField: false });
    await controller.armAutofill();
    expect(authenticate).not.toHaveBeenCalled();
  });

  it("says nothing when the quiet request is dismissed", async () => {
    const { controller, view } = setup({
      autofill: true,
      hasAutofillField: true,
      results: ["cancelled"],
    });
    await controller.armAutofill();
    expect(view.summary).not.toHaveBeenCalled();
    expect(view.quietNote).not.toHaveBeenCalled();
    expect(view.proceed).not.toHaveBeenCalled();
  });

  it.each(["unsupported", "unavailable", "already_on_device", "rate_limited"] as const)(
    "says nothing when the quiet request fails as %s: the person never asked for it",
    async (failure) => {
      const { controller, view } = setup({
        autofill: true,
        hasAutofillField: true,
        results: [failure],
      });
      await controller.armAutofill();
      expect(view.summary).not.toHaveBeenCalled();
    },
  );

  it("does not start the quiet request again after the button was rate limited", async () => {
    const { controller, view, authenticate } = setup({
      autofill: true,
      hasAutofillField: true,
      results: ["cancelled", "rate_limited"],
    });
    await controller.armAutofill();
    const before = authenticate.mock.calls.length;
    await controller.signIn();
    expect(view.summary).toHaveBeenCalledWith(PASSKEY_COPY.signIn.rateLimited);
    // One call for the button itself, none to restart the quiet request.
    expect(authenticate.mock.calls.length - before).toBe(1);
  });

  it("restarts the quiet request after another failed button try, once it was started", async () => {
    const { controller, authenticate } = setup({
      autofill: true,
      hasAutofillField: true,
      results: ["cancelled", "cancelled", "ok"],
    });
    await controller.armAutofill();
    await controller.signIn();
    // quiet (dismissed), button (closed), quiet again.
    expect(authenticate).toHaveBeenCalledTimes(3);
  });

  it("does not start the quiet request after a failed button try if the box was never reached for", async () => {
    const { controller, authenticate } = setup({
      autofill: true,
      hasAutofillField: true,
      results: ["cancelled"],
    });
    await controller.signIn();
    expect(authenticate).toHaveBeenCalledTimes(1);
  });

  it("signs in with the button and carries on with the issuer's answer", async () => {
    const { controller, view } = setup();
    await controller.signIn();
    expect(view.busy.mock.calls).toEqual([[true], [false]]);
    expect(view.proceed).toHaveBeenCalledWith({ url: "/next" });
    expect(view.summary).not.toHaveBeenCalled();
  });

  it("puts a closed prompt in the quiet line and returns focus to the button", async () => {
    const { controller, view } = setup({ results: ["cancelled"] });
    await controller.signIn();
    expect(view.quietNote).toHaveBeenLastCalledWith(PASSKEY_COPY.signIn.cancelled);
    expect(view.summary).not.toHaveBeenCalled();
    expect(view.focusButton).toHaveBeenCalled();
    expect(view.proceed).not.toHaveBeenCalled();
  });

  it.each([
    ["not_recognised", PASSKEY_COPY.signIn.notRecognised],
    ["not_verified", PASSKEY_COPY.signIn.notVerified],
    ["wrong_person", PASSKEY_COPY.signIn.wrongPerson],
    ["rate_limited", PASSKEY_COPY.signIn.rateLimited],
    ["unavailable", PASSKEY_COPY.signIn.unavailable],
  ] as const)("puts %s in the summary at the top", async (failure, message) => {
    const { controller, view } = setup({ results: [failure] });
    await controller.signIn();
    expect(view.summary).toHaveBeenCalledWith(message);
    expect(view.focusButton).toHaveBeenCalled();
    expect(view.proceed).not.toHaveBeenCalled();
  });

  it("clears the last message before each try", async () => {
    const { controller, view } = setup();
    await controller.signIn();
    expect(view.clearStatus).toHaveBeenCalled();
    expect(view.quietNote).toHaveBeenCalledWith(null);
  });

  it("has a sentence for every failure", () => {
    for (const line of Object.values(SIGN_IN_FAILURE_LINES)) {
      expect(line.message.length).toBeGreaterThan(10);
    }
  });
});
