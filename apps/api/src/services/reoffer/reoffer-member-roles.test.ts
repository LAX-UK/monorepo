import { describe, expect, it } from "vitest";
import type { ReofferMemberActor } from "./reoffer-actors.js";
import { ReofferConsentService } from "./reoffer-consent.service.js";
import type { ReofferError } from "./reoffer-errors.js";
import { ReofferReadsService } from "./reoffer-reads.service.js";
import { ReofferResponseService } from "./reoffer-response.service.js";

const never = new Proxy({}, { get: () => () => Promise.reject(new Error("reached a dependency")) });
const tx = { runInTransaction: () => Promise.reject(new Error("reached the transaction")) };

const response = new ReofferResponseService({
  transactionRunner: tx as never,
  workflow: never as never,
  offers: never as never,
  consents: never as never,
  reaward: never as never,
  recorder: never as never,
  atg: never as never,
  place: never as never,
  moneyPause: never as never,
  invoicing: never as never,
  pricing: never as never,
});
const consent = new ReofferConsentService({
  transactionRunner: tx as never,
  workflow: never as never,
  offers: never as never,
  consents: never as never,
  recorder: never as never,
});
const reads = new ReofferReadsService({
  db: never as never,
  views: never as never,
  workflow: never as never,
  pricing: never as never,
});

const actor = (over: Partial<ReofferMemberActor> = {}): ReofferMemberActor => ({
  userId: "u1",
  legalEntityId: "e1",
  role: "owner",
  ...over,
});
const code = async (promise: Promise<unknown>) =>
  (
    (await promise.then(
      () => null,
      (e: unknown) => e,
    )) as ReofferError | null
  )?.code;

describe("a platform admin acting for an account", () => {
  it("can neither accept, decline nor answer for it", async () => {
    const admin = actor({ isImpersonation: true });
    expect(
      await code(response.accept(admin, "o1", { termsAccepted: true, expectedTotalMinor: 0 })),
    ).toBe("forbidden");
    expect(await code(response.decline(admin, "o1", {}))).toBe("forbidden");
    expect(await code(consent.answerInWorkspace(admin, "o1", { answer: "given" }))).toBe(
      "forbidden",
    );
  });

  it("is refused before anything is read", async () => {
    // The stubs reject on any call: a forbidden answer proves the check came first.
    expect(
      await code(
        response.accept(actor({ role: "viewer" }), "o1", {
          termsAccepted: true,
          expectedTotalMinor: 0,
        }),
      ),
    ).toBe("forbidden");
  });

  it("can still see the seller's requests only through a role that reads consignments", async () => {
    expect(await code(reads.listForSeller(actor({ role: "buyer_agent" })))).toBe("forbidden");
  });
});

describe("accepting", () => {
  it("is refused without the terms box ticked, before any transaction", async () => {
    expect(
      await code(response.accept(actor(), "o1", { termsAccepted: false, expectedTotalMinor: 0 })),
    ).toBe("terms_not_accepted");
  });
});
