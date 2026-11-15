import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOidcLoginPromptReader } from "./oidc-login-prompt.js";

const SECRET = "issuer-secret-that-is-long-enough-for-tests";
const KEPT = { client_id: "lax-account-web", prompt: "login", reauth_reason: "change_name" };

/** Signed the way Better Auth signs its cookies: `value.base64(HMAC-SHA256)`, URL-encoded. */
function signed(value: string, secret = SECRET): string {
  const signature = createHmac("sha256", secret).update(value).digest("base64");
  return encodeURIComponent(`${value}.${signature}`);
}

function read(cookie: string | null) {
  const headers = new Headers(cookie ? { cookie } : {});
  return createOidcLoginPromptReader(async () => SECRET)(headers);
}

describe("reading the OIDC provider's kept authorize request", () => {
  it("returns the request the provider signed", async () => {
    const params = await read(`a=1; oidc_login_prompt=${signed(JSON.stringify(KEPT))}; b=2`);
    expect(params && Object.fromEntries(params)).toEqual(KEPT);
  });

  it("ignores a request the browser wrote or changed", async () => {
    const original = signed(JSON.stringify(KEPT));
    const forged = original.replace("change_name", "sign_out_devices");
    expect(await read(`oidc_login_prompt=${forged}`)).toBeNull();
    expect(await read(`oidc_login_prompt=${encodeURIComponent(JSON.stringify(KEPT))}`)).toBeNull();
  });

  it("ignores a request signed with another secret", async () => {
    const other = signed(JSON.stringify(KEPT), "another-secret-that-is-long-enough-too");
    expect(await read(`oidc_login_prompt=${other}`)).toBeNull();
  });

  it("is absent without the cookie, or when the signed value is not an object", async () => {
    expect(await read(null)).toBeNull();
    expect(await read("other=1")).toBeNull();
    expect(await read(`oidc_login_prompt=${signed("not json")}`)).toBeNull();
    expect(await read(`oidc_login_prompt=${signed("[1]")}`)).toBeNull();
  });

  it("keeps only string values", async () => {
    const params = await read(
      `oidc_login_prompt=${signed(JSON.stringify({ ...KEPT, max_age: 300, extra: { a: 1 } }))}`,
    );
    expect(params && Object.fromEntries(params)).toEqual(KEPT);
  });
});
