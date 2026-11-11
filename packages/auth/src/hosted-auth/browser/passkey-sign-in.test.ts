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
    if (next === "cancelled") throw Object.assign(new Error("x"), { name: "NotAllowedError" });
    return { id: "cred", response: {} };
  });
  const verifyFailures: Partial<Record<PasskeyFailure, [number, unknown]>> = {
    not_recognised: [401, { code: "PASSKEY_NOT_FOUND" }],
    not_verified: [403, { code: "passkey_user_verification_required" }],
    wrong_person: [403, { code: "passkey_wrong_person" }],
    rate_limited: [429, {}],
    unavailable: [500, {}],
  };
  let last: "ok" | PasskeyFailure = "ok";
  const runtime: PasskeyRuntime = {
    supportsPasskeys: () => options.supports ?? true,
    supportsAutofill: async () => options.autofill ?? false,
    authenticate: async () => {
      last = options.results ? (options.results[0] ?? "ok") : "ok";
      const result = await authenticate();
      return result;
    },
    register: vi.fn(),
    fetch: (async (_url: string, init?: RequestInit) => {
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
  return { controller, view, authenticate };
}

describe("passkey sign-in controller", () => {
  it("shows nothing where the browser cannot use passkeys", async () => {
    const { controller, view } = setup({ supports: false });
    await controller.start();
    expect(view.reveal).not.toHaveBeenCalled();
  });

  it("reveals the button, and starts the quiet request only when the page has the field", async () => {
    const withField = setup({ autofill: true, hasAutofillField: true });
    await withField.controller.start();
    expect(withField.view.reveal).toHaveBeenCalled();
    expect(withField.authenticate).toHaveBeenCalledTimes(1);
    expect(withField.view.proceed).toHaveBeenCalledWith({ url: "/next" });

    const withoutField = setup({ autofill: true, hasAutofillField: false });
    await withoutField.controller.start();
    expect(withoutField.view.reveal).toHaveBeenCalled();
    expect(withoutField.authenticate).not.toHaveBeenCalled();
  });

  it("says nothing when the quiet request is dismissed", async () => {
    const { controller, view } = setup({
      autofill: true,
      hasAutofillField: true,
      results: ["cancelled"],
    });
    await controller.start();
    expect(view.summary).not.toHaveBeenCalled();
    expect(view.quietNote).not.toHaveBeenCalled();
    expect(view.proceed).not.toHaveBeenCalled();
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
