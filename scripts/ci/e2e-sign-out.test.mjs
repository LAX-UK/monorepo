import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  endSessionTarget,
  forgetSignIn,
  rememberSignIn,
  signOutContext,
  signOutRememberedSignIns,
} from "./e2e-sign-out.mjs";

const origin = "http://localhost:3000";

describe("end-session target", () => {
  it("reads the redirect a script is given as JSON", () => {
    assert.equal(
      endSessionTarget(
        { status: 200, headers: {}, body: { redirectTo: "http://localhost:3003/end?x=1" } },
        origin,
      ),
      "http://localhost:3003/end?x=1",
    );
  });

  it("follows a redirect answer, resolving a relative location", () => {
    assert.equal(
      endSessionTarget({ status: 303, headers: { location: "/signed-out" }, body: null }, origin),
      "http://localhost:3000/signed-out",
    );
  });

  it("has nowhere to send the browser when the product ended the session itself", () => {
    assert.equal(endSessionTarget({ status: 200, headers: {}, body: {} }, origin), null);
    assert.equal(endSessionTarget({ status: 303, headers: {}, body: null }, origin), null);
  });
});

function fakeContext(answer) {
  const calls = { posts: [], visited: [] };
  const context = {
    request: {
      async post(url, options) {
        calls.posts.push({ url, options });
        return answer;
      },
    },
    async newPage() {
      return {
        async goto(url) {
          calls.visited.push(url);
        },
        async close() {},
      };
    },
  };
  return { context, calls };
}

const answer = (status, headers, body) => ({
  status: () => status,
  headers: () => headers,
  json: async () => body,
});

describe("sign out through the product", () => {
  it("posts from the product's own origin, then ends the sign-in service's session", async () => {
    const { context, calls } = fakeContext(
      answer(200, {}, { redirectTo: "http://localhost:3003/api/auth/oauth2/endsession?x=1" }),
    );
    await signOutContext(context, { origin: "http://localhost:3000/some/path" });
    assert.equal(calls.posts[0].url, "http://localhost:3000/api/auth/logout");
    assert.equal(calls.posts[0].options.headers.origin, "http://localhost:3000");
    assert.deepEqual(calls.visited, ["http://localhost:3003/api/auth/oauth2/endsession?x=1"]);
  });

  it("refuses to carry on when the product rejects the request", async () => {
    const { context } = fakeContext(answer(403, {}, { error: "invalid_origin" }));
    await assert.rejects(signOutContext(context, { origin }), /answered 403/);
  });
});

describe("remembered sign-ins", () => {
  it("signs out each remembered context once and skips those that signed out themselves", async () => {
    const signedOut = [];
    const first = {};
    const second = {};
    rememberSignIn(first, async (c) => signedOut.push(c));
    rememberSignIn(second, async (c) => signedOut.push(c));
    forgetSignIn(second);
    await signOutRememberedSignIns();
    await signOutRememberedSignIns();
    assert.deepEqual(signedOut, [first]);
  });

  it("keeps going when one sign-out fails", async () => {
    const signedOut = [];
    const warn = console.warn;
    console.warn = () => {};
    try {
      rememberSignIn({}, async () => {
        throw new Error("boom");
      });
      const ok = {};
      rememberSignIn(ok, async (c) => signedOut.push(c));
      await signOutRememberedSignIns();
    } finally {
      console.warn = warn;
    }
    assert.equal(signedOut.length, 1);
  });
});
