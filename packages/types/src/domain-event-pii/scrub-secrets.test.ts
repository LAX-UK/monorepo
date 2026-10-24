import { describe, expect, it } from "vitest";
import { SECRET_PLACEHOLDER, scrubPayloadSecrets } from "./scrub-secrets.js";

// Fake credential shapes, assembled so no scanner mistakes them for real keys.
const FAKE_WEBHOOK = ["whsec", "0123456789"].join("_");
const FAKE_BEARER = ["Bearer", "abc.def.ghi"].join(" ");

describe("scrubPayloadSecrets", () => {
  it("hides credentials by key at any depth and keeps ordinary fields", () => {
    const out = scrubPayloadSecrets({
      reason: "lost phone",
      accessToken: "abc",
      nested: { password: "p", list: [{ apiKey: "k", status: "ok" }] },
    });
    expect(out).toEqual({
      reason: "lost phone",
      accessToken: SECRET_PLACEHOLDER,
      nested: {
        password: SECRET_PLACEHOLDER,
        list: [{ apiKey: SECRET_PLACEHOLDER, status: "ok" }],
      },
    });
  });

  it("hides credential-shaped values under harmless keys", () => {
    const out = scrubPayloadSecrets({ note: FAKE_BEARER, ref: FAKE_WEBHOOK, plain: "hello" });
    expect(out).toEqual({ note: SECRET_PLACEHOLDER, ref: SECRET_PLACEHOLDER, plain: "hello" });
  });

  it("keeps fields that only describe a credential change", () => {
    expect(scrubPayloadSecrets({ credential_changed: true, method: "password" })).toEqual({
      credential_changed: true,
      method: "password",
    });
  });

  it("passes primitives and null through", () => {
    expect(scrubPayloadSecrets(null)).toBeNull();
    expect(scrubPayloadSecrets(12)).toBe(12);
    expect(scrubPayloadSecrets(["a", 1])).toEqual(["a", 1]);
  });
});
