import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, it } from "node:test";
import shield from "./shield.js";

const TARGET = "https://auctions.lax.bid/auction/123?x=1";
const realFetch = globalThis.fetch;

/** Replaces the upstream (ATG) fetch; records what the Worker forwarded. */
function stubUpstream(response = () => new Response("ok")) {
  const forwarded = [];
  globalThis.fetch = async (request) => {
    forwarded.push(request);
    return response(request);
  };
  return forwarded;
}

function upstreamWithCookies(...setCookies) {
  return () => {
    const headers = new Headers({ "content-type": "text/html" });
    for (const value of setCookies) headers.append("Set-Cookie", value);
    return new Response("<html></html>", { status: 200, headers });
  };
}

describe("ATG cookie shield", () => {
  beforeEach(() => {
    globalThis.fetch = realFetch;
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("removes every LAX cookie and keeps ATG's own cookies", async () => {
    const forwarded = stubUpstream();

    await shield.fetch(
      new Request(TARGET, {
        headers: {
          cookie: [
            "__Secure-better-auth.session_token=secret",
            "__Secure-better-auth.session_data=cache",
            "better-auth.two_factor=pending",
            "lax_acting_legal_entity_id=le-1",
            "lax_consent=analytics",
            "_lax_attr=utm",
            "ASP.NET_SessionId=atg-session",
            ".AspNetCore.Cookies=atg-auth",
            "_ga=GA1.1.123",
          ].join("; "),
        },
      }),
    );

    assert.equal(
      forwarded[0].headers.get("cookie"),
      "ASP.NET_SessionId=atg-session; .AspNetCore.Cookies=atg-auth; _ga=GA1.1.123",
    );
  });

  it("drops the Cookie header when only LAX cookies were sent", async () => {
    const forwarded = stubUpstream();

    await shield.fetch(
      new Request(TARGET, { headers: { cookie: "better-auth.session_token=s; LAX_THEME=dark" } }),
    );

    assert.equal(forwarded[0].headers.has("cookie"), false);
  });

  it("forwards method, URL, other headers and body unchanged", async () => {
    const forwarded = stubUpstream();

    await shield.fetch(
      new Request(TARGET, {
        method: "POST",
        headers: { "content-type": "application/json", "x-requested-with": "XMLHttpRequest" },
        body: JSON.stringify({ bid: 1500 }),
      }),
    );

    const request = forwarded[0];
    assert.equal(request.method, "POST");
    assert.equal(request.url, TARGET);
    assert.equal(request.headers.get("x-requested-with"), "XMLHttpRequest");
    assert.deepEqual(await request.json(), { bid: 1500 });
  });

  it("makes ATG cookies host-only and refuses LAX-named cookies", async () => {
    stubUpstream(
      upstreamWithCookies(
        "ATGSession=abc; Domain=.lax.bid; Path=/; Secure; HttpOnly; SameSite=Lax",
        "pref=1; path=/; domain=lax.bid; Expires=Wed, 21 Oct 2026 07:28:00 GMT",
        "local=1; Domain=auctions.lax.bid; Path=/",
        "__Secure-better-auth.session_token=forged; Domain=.lax.bid; Path=/; Secure",
        "lax_acting_legal_entity_id=attacker; Domain=.lax.bid; Path=/",
      ),
    );

    const response = await shield.fetch(new Request(TARGET));

    assert.deepEqual(response.headers.getSetCookie(), [
      "ATGSession=abc; Path=/; Secure; HttpOnly; SameSite=Lax",
      "pref=1; path=/; Expires=Wed, 21 Oct 2026 07:28:00 GMT",
      "local=1; Path=/",
    ]);
  });

  it("passes the status, headers and body through and marks the response", async () => {
    stubUpstream(
      () =>
        new Response("moved", {
          status: 302,
          statusText: "Found",
          headers: { location: "/login", "cache-control": "no-store" },
        }),
    );

    const response = await shield.fetch(new Request(TARGET));

    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), "/login");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("x-lax-cookie-shield"), "1");
    assert.equal(await response.text(), "moved");
  });

  it("returns WebSocket upgrades untouched when they set no cookies", async () => {
    const upgrade = { status: 101, headers: new Headers({ upgrade: "websocket" }) };
    stubUpstream(() => upgrade);

    const response = await shield.fetch(
      new Request(TARGET, { headers: { upgrade: "websocket", cookie: "lax_consent=1; atg=1" } }),
    );

    assert.equal(response, upgrade);
  });

  it("fails closed with a 502 when ATG cannot be reached", async () => {
    stubUpstream(() => {
      throw new TypeError("network error");
    });

    const response = await shield.fetch(new Request(TARGET));

    assert.equal(response.status, 502);
    assert.equal(response.headers.get("x-lax-cookie-shield"), "1");
  });

  it("never fails open and only has the default export", () => {
    const source = readFileSync(new URL("./shield.js", import.meta.url), "utf8");
    const code = source.replace(/^\s*\/\/.*$/gm, "");
    assert.equal(code.includes("passThroughOnException"), false);
    assert.deepEqual(
      source.match(/^export\s+(?!default\b)\S+/gm),
      null,
      "named exports would be treated as Worker entrypoints",
    );
  });
});
