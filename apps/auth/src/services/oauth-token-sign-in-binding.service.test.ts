import { UnsecuredJWT } from "jose";
import { describe, expect, it, vi } from "vitest";
import { OAuthTokenSignInBinding } from "./oauth-token-sign-in-binding.service.js";

const idToken = (claims: Record<string, unknown>) => new UnsecuredJWT(claims).encode();

function setup(bound = true, signedIn = true) {
  const store = {
    bindRefreshToken: vi.fn(async () => bound),
    discardRefreshToken: vi.fn(async () => undefined),
  };
  const isSignedIn = vi.fn(async (_sid: string, _subjectId: string) => signedIn);
  return { binding: new OAuthTokenSignInBinding(store, isSignedIn), store, isSignedIn };
}

describe("OAuthTokenSignInBinding", () => {
  it("records the ID token's sid on the token", async () => {
    const { binding, store, isSignedIn } = setup();
    await binding.bindIssued({
      refreshToken: "r1",
      idToken: idToken({ sid: "rec-1", sub: "ann" }),
    });
    expect(store.bindRefreshToken).toHaveBeenCalledWith("r1", "rec-1");
    expect(isSignedIn).toHaveBeenCalledWith("rec-1", "ann");
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
      binding.bindIssued({ refreshToken: "r1", idToken: idToken({ sid: "rec-1", sub: "ann" }) }),
    ).rejects.toThrow("not persisted");
    expect(store.discardRefreshToken).toHaveBeenCalledWith("r1");
  });

  it("deletes the tokens and fails when the sign-in ended while the code was being exchanged", async () => {
    const { binding, store } = setup(true, false);
    await expect(
      binding.bindIssued({
        refreshToken: "r1",
        idToken: idToken({ sid: "rec-1", sub: "ann" }),
      }),
    ).rejects.toThrow("has ended");
    // Recorded first, so a sign-out that runs from here on finds the token; this one is deleted.
    expect(store.bindRefreshToken).toHaveBeenCalled();
    expect(store.discardRefreshToken).toHaveBeenCalledWith("r1");
  });
});
