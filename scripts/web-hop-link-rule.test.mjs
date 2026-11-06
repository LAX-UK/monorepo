import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findHopLinks } from "./web-hop-link-rule.mjs";

describe("findHopLinks", () => {
  it("flags a router link built with a hop helper", () => {
    const source =
      "const a = 1;\n<Link href={switchAccountHref(id, next)} prefetch={false}>Go</Link>";
    assert.deepEqual(findHopLinks(source), [2]);
  });

  it("flags a button link to a literal hop path, across lines", () => {
    const source = `<ButtonLink\n  size="sm"\n  href="/restore-account?next=/home"\n>\n  Go\n</ButtonLink>`;
    assert.deepEqual(findHopLinks(source), [1]);
  });

  it("flags the route constants", () => {
    assert.deepEqual(findHopLinks("<Link href={CLIENT_ROUTES.accountSwitch}>x</Link>"), [1]);
    assert.deepEqual(findHopLinks("<Link href={CLIENT_ROUTES.accountRestore}>x</Link>"), [1]);
  });

  it("allows a plain anchor, which loads a page", () => {
    assert.deepEqual(findHopLinks("<a href={restoreAccountHref(next)}>Continue</a>"), []);
  });

  it("allows router links to ordinary pages", () => {
    assert.deepEqual(findHopLinks('<Link href="/bids" onClick={() => go()}>Bids</Link>'), []);
  });

  it("does not read past an arrow function in an attribute", () => {
    const source = '<Link href="/bids" onClick={() => go()}>Bids</Link>\n<p>switchAccountHref</p>';
    assert.deepEqual(findHopLinks(source), []);
  });
});
