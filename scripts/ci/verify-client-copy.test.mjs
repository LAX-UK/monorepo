import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLIENT_COPY_EXCEPTIONS,
  collectCopyStrings,
  findForbiddenCopy,
  isClientCopyPath,
  lintClientCopy,
} from "./verify-client-copy.mjs";

const terms = (source, file = "page.tsx") => findForbiddenCopy(source, file).map((m) => m.term);

describe("findForbiddenCopy: failing samples", () => {
  it("finds a vendor name in JSX text", () => {
    assert.deepEqual(terms("export const A = () => <p>Manage in Stripe</p>;"), ["Stripe"]);
  });

  it("finds terms in string and template literals, whatever the case", () => {
    assert.deepEqual(terms('const a = "Upload your kyb files";', "copy.ts"), ["KYB"]);
    assert.deepEqual(terms("const b = `${name} is the Primary Admin`;", "copy.ts"), [
      "primary admin",
    ]);
    assert.deepEqual(terms('const c = { label: "Connect pending" };', "copy.ts"), [
      "Connect pending",
    ]);
  });

  it("finds a vendor in an attribute a person reads", () => {
    assert.deepEqual(terms('export const A = () => <img alt="Veriff logo" />;'), ["Veriff"]);
  });

  it("finds 2FA, finance review and US spellings", () => {
    assert.deepEqual(terms('const a = "2FA off";', "a.ts"), ["2FA"]);
    assert.deepEqual(terms('const a = "Needs finance review";', "a.ts"), ["finance review"]);
    assert.deepEqual(terms('const a = "We favor speed";', "a.ts"), ["favor"]);
  });

  it("finds the workspace's banned process words", () => {
    assert.deepEqual(terms('const a = "Withdraw submission";', "a.ts"), ["submission"]);
    assert.deepEqual(terms("export const A = () => <p>Your submissions</p>;"), ["submission"]);
    assert.deepEqual(terms('const a = "Voided";', "a.ts"), ["voided"]);
    assert.deepEqual(terms('const a = "Back to the Marketing site";', "a.ts"), ["Marketing site"]);
    assert.deepEqual(terms('const a = "Your auto-bid is set";', "a.ts"), ["auto-bid"]);
    assert.deepEqual(terms('const a = "Autobids stop at your limit";', "a.ts"), ["auto-bid"]);
  });

  it("finds pending on its own, as a badge or a label", () => {
    assert.deepEqual(terms("export const A = () => <Badge>Pending</Badge>;"), ["pending"]);
    assert.deepEqual(terms('const s = { pending: "Pending" };', "a.ts"), ["pending"]);
    assert.deepEqual(terms('const s = "pending…";', "a.ts"), ["pending"]);
  });

  it("finds Organisation settings as a menu label", () => {
    assert.deepEqual(terms('const nav = { label: "Organisation settings" };', "a.ts"), [
      "Organisation settings",
    ]);
  });

  it("reports the line of the copy", () => {
    const [match] = findForbiddenCopy('const a = 1;\nconst b = "Paid through Stripe";\n', "a.ts");
    assert.equal(match?.line, 2);
  });
});

describe("findForbiddenCopy: passing samples", () => {
  it("ignores imports, types and identifiers", () => {
    const source = [
      'import { useStripeConnect } from "@/hooks/use-stripe-connect";',
      'import type { StripeConnectStatus } from "@stripe/connect-js";',
      'type Code = "stripe_disabled" | "kyb";',
      "const stripeAccountId = status.stripeAccountId;",
      "export function SellerStripeConnectPage() { return null; }",
    ].join("\n");
    assert.deepEqual(terms(source, "a.ts"), []);
  });

  it("ignores comments", () => {
    const source = [
      "// Stripe Connect onboarding (Custom accounts).",
      "/** Veriff KYC gates Connect for individual sellers. */",
      "export const A = () => <div>{/* Stripe banner lists tasks */}Payouts</div>;",
    ].join("\n");
    assert.deepEqual(terms(source), []);
  });

  it("ignores object keys, paths and code tokens", () => {
    const source = [
      'const errors = { stripe_upstream_error: "We couldn\'t reach our payment partner." };',
      'const url = "/api/stripe-connect/session";',
      "const href = `/verify-identity?kyc=complete&next=${next}`;",
      'const cls = "kyc-banner";',
      'const map = { "Connect pending": 1 };',
    ].join("\n");
    assert.deepEqual(terms(source, "a.ts"), []);
  });

  it("ignores console calls", () => {
    assert.deepEqual(
      terms('console.error("Stripe Connect embedded component error", e);', "a.ts"),
      [],
    );
  });

  it("does not match a term inside a longer word", () => {
    assert.deepEqual(terms('const a = "Pinstripe frame, favourite piece";', "a.ts"), []);
  });

  it("keeps pending inside a phrase, and the words the rules suggest", () => {
    const source = [
      'const a = "Pending invitations";',
      'const b = "Waiting for approval";',
      'const c = "Set a maximum bid";',
      'const d = "Sell a work";',
      'const e = "submission_image";',
    ].join("\n");
    assert.deepEqual(terms(source, "a.ts"), []);
  });

  it("keeps plain copy", () => {
    assert.deepEqual(terms("export const A = () => <p>Payouts not set up</p>;"), []);
  });
});

describe("collectCopyStrings", () => {
  it("joins the fixed parts of a template around its interpolations", () => {
    const [piece] = collectCopyStrings("const a = `Hello ${name}, welcome`;", "a.ts");
    assert.equal(piece?.text, "Hello … , welcome");
  });
});

describe("isClientCopyPath", () => {
  it("reads client pages and workspace components, never tests", () => {
    assert.equal(isClientCopyPath("apps/web/src/app/(client)/organisation/page.tsx"), true);
    assert.equal(isClientCopyPath("apps/web/src/components/organisations/card.tsx"), true);
    assert.equal(isClientCopyPath("apps/web/src/lib/presenters/x.ts"), true);
    assert.equal(isClientCopyPath("apps/web/src/components/organisations/card.test.tsx"), false);
    assert.equal(isClientCopyPath("apps/web/src/components/admin/panel.tsx"), false);
    assert.equal(isClientCopyPath("apps/web/src/app/(client)/organisation/styles.css"), false);
  });
});

describe("lintClientCopy", () => {
  const file = "apps/web/src/components/organisations/card.tsx";

  it("fails on a forbidden term", () => {
    const { violations } = lintClientCopy(
      [[file, "export const A = () => <p>Via Stripe</p>;"]],
      [],
    );
    assert.equal(violations.length, 1);
    assert.equal(violations[0]?.path, file);
  });

  it("allows a reviewed exception and reports one that no longer matches", () => {
    const exceptions = [
      { path: file, term: "Stripe", reason: "Legal notice." },
      { path: file, term: "KYB", reason: "Stale." },
    ];
    const { violations, stale } = lintClientCopy(
      [[file, "export const A = () => <p>Via Stripe</p>;"]],
      exceptions,
    );
    assert.deepEqual(violations, []);
    assert.deepEqual(
      stale.map((entry) => entry.term),
      ["KYB"],
    );
  });

  it("skips files outside the client copy folders", () => {
    const { violations } = lintClientCopy(
      [["apps/web/src/components/admin/a.tsx", "export const A = () => <p>Stripe</p>;"]],
      [],
    );
    assert.deepEqual(violations, []);
  });

  it("gives every exception a reason", () => {
    for (const entry of CLIENT_COPY_EXCEPTIONS) assert.ok(entry.reason.trim().length > 0);
  });
});
