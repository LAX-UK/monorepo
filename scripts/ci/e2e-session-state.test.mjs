import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  cookieHeaderFromStorageState,
  formatProbeFailure,
  parseSetCookieHeader,
  storageStateFromSetCookies,
} from "./e2e-session-state.mjs";

describe("e2e session state cookies", () => {
  it("parses Better Auth session cookies onto the web hostname", () => {
    const cookie = parseSetCookieHeader(
      "better-auth.session_token=abc.def; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800",
      "localhost",
    );
    assert.equal(cookie?.name, "better-auth.session_token");
    assert.equal(cookie?.value, "abc.def");
    assert.equal(cookie?.domain, "localhost");
    assert.equal(cookie?.httpOnly, true);
    assert.equal(cookie?.sameSite, "Lax");
    assert.ok((cookie?.expires ?? 0) > Math.floor(Date.now() / 1000));
  });

  it("builds a Playwright storage state and cookie header without leaking extras", () => {
    const state = storageStateFromSetCookies(
      [
        "better-auth.session_token=tok; Path=/; HttpOnly; SameSite=Lax",
        "better-auth.session_data=cache; Path=/; SameSite=Lax",
      ],
      "localhost",
    );
    assert.equal(state.cookies.length, 2);
    assert.deepEqual(state.origins, []);
    assert.equal(
      cookieHeaderFromStorageState(state),
      "better-auth.session_token=tok; better-auth.session_data=cache",
    );
  });

  it("formats a redacted probe failure for CI logs", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "e2e-auth-"));
    const file = path.join(dir, "staff.json");
    writeFileSync(file, "{}\n");
    const message = formatProbeFailure("staff", file, {
      authStatus: 200,
      meStatus: 401,
      cookieNames: ["better-auth.session_token"],
      cookieDomain: "localhost",
    });
    assert.match(message, /staff/);
    assert.match(message, /get-session=200/);
    assert.match(message, /\/api\/auth\/me=401/);
    assert.doesNotMatch(message, /tok=/);
  });
});
