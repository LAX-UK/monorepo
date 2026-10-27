import { describe, expect, it } from "vitest";
import {
  ACCOUNT_DELETION_CONFIRMATION_PHRASE,
  ACCOUNT_DELETION_GRACE_DAYS,
  type AccountDeletionStatus,
  DELETION_ELIGIBILITY_PRODUCTS,
  accountDeletionCancelOutcomeSchema,
  accountDeletionOutcomeSchema,
  accountDeletionStatusSchema,
  accountDeletionVerdict,
  deletionEligibilityPath,
  productDeletionEligibilitySchema,
} from "./deletion-eligibility.js";

const BLOCKER = {
  code: "unpaid_payment",
  message: "You have a payment to make.",
  href: "https://lax.example/purchases#payment-history",
};

describe("deletionEligibilityPath", () => {
  it("names the subject in the path, encoded", () => {
    expect(deletionEligibilityPath("abc")).toBe(
      "/internal/identity/subjects/abc/deletion-eligibility",
    );
    expect(deletionEligibilityPath("a/b?c")).toBe(
      "/internal/identity/subjects/a%2Fb%3Fc/deletion-eligibility",
    );
  });
});

describe("productDeletionEligibilitySchema", () => {
  it("accepts a product with and without blockers, and a blocker with no page", () => {
    expect(
      productDeletionEligibilitySchema.safeParse({ product: "bid", blockers: [] }).success,
    ).toBe(true);
    expect(
      productDeletionEligibilitySchema.safeParse({
        product: "shop",
        blockers: [BLOCKER, { ...BLOCKER, href: null }],
      }).success,
    ).toBe(true);
  });

  it.each([
    ["an unknown product", { product: "art", blockers: [] }],
    ["a blocker with no message", { product: "bid", blockers: [{ ...BLOCKER, message: "" }] }],
    [
      "a blocker whose link is not a URL",
      { product: "bid", blockers: [{ ...BLOCKER, href: "/pay" }] },
    ],
    ["no blockers list", { product: "bid" }],
  ])("rejects %s", (_label, body) => {
    expect(productDeletionEligibilitySchema.safeParse(body).success).toBe(false);
  });
});

describe("accountDeletionVerdict", () => {
  const clear = DELETION_ELIGIBILITY_PRODUCTS.map((product) => ({
    product,
    state: "clear" as const,
    blockers: [],
  }));
  const status = (patch: Partial<AccountDeletionStatus>): AccountDeletionStatus => ({
    requestedAt: null,
    products: clear,
    ...patch,
  });

  it("is eligible only when every product is clear and nothing was requested", () => {
    expect(accountDeletionVerdict(status({}))).toBe("eligible");
  });

  it("is blocked when any product names something to resolve", () => {
    expect(
      accountDeletionVerdict(
        status({
          products: [{ product: "bid", state: "blocked", blockers: [BLOCKER] }, ...clear.slice(1)],
        }),
      ),
    ).toBe("blocked");
  });

  it("is unavailable when a product could not be asked, never eligible", () => {
    expect(
      accountDeletionVerdict(
        status({
          products: [clear[0] as never, { product: "shop", state: "unavailable", blockers: [] }],
        }),
      ),
    ).toBe("unavailable");
  });

  it("shows what is blocked first when one product is blocked and another is silent", () => {
    expect(
      accountDeletionVerdict(
        status({
          products: [
            { product: "bid", state: "blocked", blockers: [BLOCKER] },
            { product: "shop", state: "unavailable", blockers: [] },
          ],
        }),
      ),
    ).toBe("blocked");
  });

  it("is requested once deletion has been asked for, whatever the products say", () => {
    expect(accountDeletionVerdict(status({ requestedAt: "2026-10-23T12:00:00.000Z" }))).toBe(
      "requested",
    );
  });

  it("parses the status the issuer sends", () => {
    expect(
      accountDeletionStatusSchema.safeParse({ requestedAt: null, products: clear }).success,
    ).toBe(true);
    expect(
      accountDeletionStatusSchema.safeParse({ requestedAt: "yesterday", products: clear }).success,
    ).toBe(false);
  });
});

describe("accountDeletionOutcomeSchema", () => {
  const status: AccountDeletionStatus = {
    requestedAt: null,
    products: [{ product: "bid", state: "unavailable", blockers: [] }],
  };

  it("parses each outcome of a deletion request", () => {
    expect(
      accountDeletionOutcomeSchema.safeParse({
        outcome: "requested",
        requestedAt: "2026-10-23T12:00:00.000Z",
      }).success,
    ).toBe(true);
    expect(
      accountDeletionOutcomeSchema.safeParse({
        outcome: "already_requested",
        requestedAt: "2026-10-01T09:00:00.000Z",
      }).success,
    ).toBe(true);
    expect(
      accountDeletionOutcomeSchema.safeParse({ outcome: "not_eligible", status }).success,
    ).toBe(true);
  });

  it.each([
    ["an outcome it does not know", { outcome: "deleted" }],
    ["a requested outcome with no date", { outcome: "requested" }],
    ["a refusal with no status", { outcome: "not_eligible" }],
    ["a bare success flag", { ok: true }],
  ])("rejects %s, so it is never read as success", (_label, body) => {
    expect(accountDeletionOutcomeSchema.safeParse(body).success).toBe(false);
  });

  it("parses the two outcomes of a cancellation", () => {
    for (const outcome of ["cancelled", "not_requested"]) {
      expect(accountDeletionCancelOutcomeSchema.safeParse({ outcome }).success).toBe(true);
    }
    expect(accountDeletionCancelOutcomeSchema.safeParse({ outcome: "maybe" }).success).toBe(false);
  });
});

describe("deletion constants", () => {
  it("asks for the phrase Bid has always asked for, and promises thirty days", () => {
    expect(ACCOUNT_DELETION_CONFIRMATION_PHRASE).toBe("DELETE MY ACCOUNT");
    expect(ACCOUNT_DELETION_GRACE_DAYS).toBe(30);
  });
});
