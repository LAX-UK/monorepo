import { afterEach, describe, expect, it, vi } from "vitest";
import { bindSocialSignIn } from "./social-sign-in.js";
import type { HostedAuthApi } from "./window-auth.js";

class FakeButton {
  dataset: Record<string, string> = {};
  click: (() => Promise<void>) | undefined;
  querySelector() {
    return null;
  }
  getAttribute() {
    return "google";
  }
  addEventListener(_type: string, handler: () => Promise<void>) {
    this.click = handler;
  }
}

function setup() {
  const button = new FakeButton();
  vi.stubGlobal("HTMLButtonElement", FakeButton);
  vi.stubGlobal("document", { querySelectorAll: () => [button] });
  const postJson = vi.fn(async (_path: string, _body: Record<string, unknown>) => ({
    response: { ok: true },
    data: {},
  }));
  const auth = {
    hideStatus: vi.fn(),
    setBusy: vi.fn(),
    productHintLoginUrl: () => "https://account.example/login",
    postJson,
    continueAfterAuth: vi.fn(),
    showError: vi.fn(),
    GENERIC_NETWORK: "network",
  } as unknown as HostedAuthApi;
  return { button, postJson, auth };
}

afterEach(() => vi.unstubAllGlobals());

describe("social sign-in request", () => {
  it("carries the statement the page showed as additionalData", async () => {
    const { button, postJson, auth } = setup();
    bindSocialSignIn(auth, () => ({ legalAcceptance: { product: "art" } }));
    await button.click?.();
    expect(postJson).toHaveBeenCalledWith(
      "/api/auth/sign-in/social",
      expect.objectContaining({ additionalData: { legalAcceptance: { product: "art" } } }),
    );
  });

  it("sends no additionalData when the page shows no statement", async () => {
    const { button, postJson, auth } = setup();
    bindSocialSignIn(auth);
    await button.click?.();
    expect(postJson.mock.calls[0]?.[1]).not.toHaveProperty("additionalData");
  });
});
