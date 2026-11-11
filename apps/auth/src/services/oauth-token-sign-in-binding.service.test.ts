import { UnsecuredJWT } from "jose";
import { describe, expect, it, vi } from "vitest";
import { OAuthTokenSignInBinding } from "./oauth-token-sign-in-binding.service.js";

const idToken = (claims: Record<string, unknown>) => new UnsecuredJWT(claims).encode();

function setup(bound = true) {
  const store = {
    bindRefreshToken: vi.fn(async () => bound),
    discardRefreshToken: vi.fn(async () => undefined),
  };
  return { binding: new OAuthTokenSignInBinding(store), store };
}

describe("OAuthTokenSignInBinding", () => {
  it("records the ID token's sid on the token", async () => {
    const { binding, store } = setup();
    await binding.bindIssued({ refreshToken: "r1", idToken: idToken({ sid: "rec-1" }) });
    expect(store.bindRefreshToken).toHaveBeenCalledWith("r1", "rec-1");
    expect(store.discardRefreshToken).not.toHaveBeenCalled();
  });

  it.each([
    ["an ID token with no sid", idToken({ sub: "ann" })],
    ["an ID token that cannot be read", "not-a-jwt"],
  ])(
    "deletes the tokens and fails for %s, so none is handed out that no sign-out could find",
    async (_name, token) => {
      const { binding, store } = setup();
      await expect(binding.bindIssued({ refreshToken: "r1", idToken: token })).rejects.toThrow();
      expect(store.discardRefreshToken).toHaveBeenCalledWith("r1");
    },
  );

  it("deletes the tokens and fails when the token row is missing", async () => {
    const { binding, store } = setup(false);
    await expect(
      binding.bindIssued({ refreshToken: "r1", idToken: idToken({ sid: "rec-1" }) }),
    ).rejects.toThrow("not persisted");
    expect(store.discardRefreshToken).toHaveBeenCalledWith("r1");
  });
});
