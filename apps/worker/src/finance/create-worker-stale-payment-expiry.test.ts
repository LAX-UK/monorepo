import type { Database } from "@auction/db";
import { createPaymentEligibilityGate } from "@auction/finance-runtime";
import { DrizzleBidActorEligibilityReader } from "@auction/persistence/repositories";
import { afterEach, describe, expect, it, vi } from "vitest";
import { workerPaymentIdentityReader } from "./create-worker-stale-payment-expiry.js";

const db = {} as Database;
const prodWorker = {
  NODE_ENV: "production" as const,
  APP_ENV: "production" as const,
  STRIPE_SECRET_KEY: undefined,
  VERIFF_API_KEY: undefined,
};

describe("workerPaymentIdentityReader", () => {
  afterEach(() => vi.restoreAllMocks());

  it("reads stored KYC status wherever payments are live, with no identity provider configured", () => {
    expect(workerPaymentIdentityReader(db, prodWorker)).toBeInstanceOf(
      DrizzleBidActorEligibilityReader,
    );
    expect(
      workerPaymentIdentityReader(db, {
        ...prodWorker,
        NODE_ENV: "development",
        APP_ENV: "development",
        STRIPE_SECRET_KEY: "sk_live_fixture",
      }),
    ).toBeInstanceOf(DrizzleBidActorEligibilityReader);
  });

  it("reads it where Veriff is configured, and not at all in a local run without it", () => {
    const local = {
      ...prodWorker,
      NODE_ENV: "development" as const,
      APP_ENV: "development" as const,
    };
    expect(workerPaymentIdentityReader(db, { ...local, VERIFF_API_KEY: "fixture" })).toBeInstanceOf(
      DrizzleBidActorEligibilityReader,
    );
    expect(workerPaymentIdentityReader(db, local)).toBeNull();
  });

  it("a verified personal buyer is payable in the prod worker, and an unverified one held", async () => {
    vi.spyOn(
      DrizzleBidActorEligibilityReader.prototype,
      "findBidActorEligibility",
    ).mockImplementation(async (userId: string) => ({
      emailVerified: true,
      kycStatus: userId === "verified" ? "approved" : "unverified",
    }));
    const gate = createPaymentEligibilityGate({
      accounts: {
        findById: async () => ({ kind: "individual", status: "approved" }) as never,
      },
      identity: workerPaymentIdentityReader(db, prodWorker),
      env: prodWorker,
    });
    await expect(
      gate.check({ payerUserId: "verified", buyerLegalEntityId: "le-1" }),
    ).resolves.toMatchObject({ kind: "payable" });
    await expect(
      gate.check({ payerUserId: "unverified", buyerLegalEntityId: "le-1" }),
    ).resolves.toMatchObject({ kind: "held" });
  });
});
