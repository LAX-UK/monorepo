import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  findHopLinks,
  findHopRedirects,
  findHopRouterCalls,
  findHopViolations,
} from "./web-hop-link-rule.mjs";

describe("findHopLinks: ?account= links", () => {
  it("flags a router link built with withAccount", () => {
    assert.deepEqual(findHopLinks("<Link href={withAccount('/home', id)}>Go</Link>"), [1]);
    assert.deepEqual(findHopLinks("<Link href={row.href}>Go</Link>"), []);
  });

  it("flags a button link built with withAccount, across lines", () => {
    const source = "<ButtonLink\n  href={withAccount(CLIENT_ROUTES.home, id)}\n  Link={Link}\n>";
    assert.deepEqual(findHopLinks(`${source}Go</ButtonLink>`), [1]);
  });

  it("flags the account-taking page helpers", () => {
    assert.deepEqual(findHopLinks('<Link href={organisationHref("payouts", id)}>x</Link>'), [1]);
    assert.deepEqual(findHopLinks('<Link href={teamHref("bidding", id)}>x</Link>'), [1]);
    assert.deepEqual(findHopLinks('<Link href={organisationHref("payouts")}>x</Link>'), []);
  });

  it("allows withAccount in a plain anchor", () => {
    assert.deepEqual(findHopLinks("<a href={withAccount('/home', id)}>Go</a>"), []);
  });
});

describe("findHopRouterCalls", () => {
  it("flags router.push and router.replace with withAccount", () => {
    assert.deepEqual(findHopRouterCalls("router.push(withAccount('/home', id));"), [1]);
    assert.deepEqual(findHopRouterCalls("a();\nrouter.replace(withAccount(HOME, id));"), [2]);
  });

  it("flags a hop builder or a hop path", () => {
    assert.deepEqual(findHopRouterCalls("router.push(switchAccountHref(id, next));"), [1]);
    assert.deepEqual(findHopRouterCalls("router.replace(restoreAccountHref(next));"), [1]);
    assert.deepEqual(findHopRouterCalls('appRouter.push("/switch-account?to=1");'), [1]);
    assert.deepEqual(findHopRouterCalls("router.push(CLIENT_ROUTES.accountRestore);"), [1]);
  });

  it("reads the whole call, including nested calls and template strings", () => {
    const source = "router.push(`${base(a(b))}${withAccount(x, id)}`, { scroll: false });";
    assert.deepEqual(findHopRouterCalls(source), [1]);
  });

  it("allows ordinary pushes, a full load, and text after the call", () => {
    assert.deepEqual(findHopRouterCalls('router.push("/bids");'), []);
    assert.deepEqual(findHopRouterCalls("window.location.assign(withAccount(HOME, id));"), []);
    assert.deepEqual(findHopRouterCalls("router.push(next);\nwithAccount(HOME, id);"), []);
  });
});

describe("findHopRedirects", () => {
  it("flags redirect() to a hop builder, a hop route or an account link", () => {
    assert.deepEqual(findHopRedirects("redirect(switchAccountHref(id, next));"), [1]);
    assert.deepEqual(findHopRedirects("if (x) redirect(restoreAccountHref(next));"), [1]);
    assert.deepEqual(findHopRedirects("redirect(CLIENT_ROUTES.accountSwitch);"), [1]);
    assert.deepEqual(findHopRedirects('redirect("/restore-account?next=/home");'), [1]);
    assert.deepEqual(findHopRedirects("redirect(withAccount('/home', id));"), [1]);
  });

  it("allows redirects to pages that change no cookie, and other redirects", () => {
    assert.deepEqual(findHopRedirects("redirect(accountsUnavailableHref(next));"), []);
    assert.deepEqual(findHopRedirects('redirect("/switch-account/unavailable");'), []);
    assert.deepEqual(findHopRedirects("redirect(CLIENT_ROUTES.accountSwitchConfirm);"), []);
    assert.deepEqual(findHopRedirects('redirect("/login");'), []);
  });

  it("does not mistake a method called redirect or a longer name", () => {
    assert.deepEqual(findHopRedirects("response.redirect(switchAccountHref(id, n));"), []);
    assert.deepEqual(findHopRedirects("permanentRedirect(switchAccountHref(id, n));"), []);
  });
});

describe("findHopViolations", () => {
  it("lists every kind, in line order", () => {
    const source = [
      "redirect(switchAccountHref(a, b));",
      "router.push(withAccount('/x', a));",
      "<Link href={withAccount('/x', a)}>x</Link>",
    ].join("\n");
    assert.deepEqual(
      findHopViolations(source).map((v) => v.line),
      [1, 2, 3],
    );
  });
});

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
