import { describe, expect, it } from "vitest";
import { evaluateConnectStepReadiness } from "./onboarding-connect-gate.js";

const BASE_ROW = {
  id: "00000000-0000-4000-8000-000000000001",
  kind: "organisation" as const,
  status: "lead" as const,
  subkind: "gallery" as const,
  displayName: "Gallery",
  legalName: null,
  slug: null,
  createdByUserId: "u1",
  statusChangedAt: null,
  statusChangedByUserId: null,
  statusReason: null,
  stripeConnectAccountId: null,
  stripeCustomerId: null,
  stripeConnectChargesEnabled: false,
  stripeConnectPayoutsEnabled: false,
  stripeConnectRequirementsCurrentlyDue: [],
  stripeConnectRequirementsErrors: [],
  stripeConnectDisabledReason: null,
  xeroContactId: null,
  vatNumber: null,
  marginSchemeEligible: false,
  isLaxManaged: false,
  platformFeeBps: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("evaluateConnectStepReadiness", () => {
  it("returns connect_not_started when no Stripe account id", () => {
    expect(evaluateConnectStepReadiness(BASE_ROW)).toEqual({
      ok: false,
      code: "connect_not_started",
    });
  });

  it("returns connect_requirements_pending when requirements are due", () => {
    const result = evaluateConnectStepReadiness({
      ...BASE_ROW,
      stripeConnectAccountId: "acct_1",
      stripeConnectRequirementsCurrentlyDue: ["individual.verification.document"],
    });
    expect(result).toEqual({ ok: false, code: "connect_requirements_pending" });
  });

  it("returns connect_restricted when disabled reason is set", () => {
    const result = evaluateConnectStepReadiness({
      ...BASE_ROW,
      stripeConnectAccountId: "acct_1",
      stripeConnectDisabledReason: "rejected.fraud",
    });
    expect(result).toEqual({ ok: false, code: "connect_restricted" });
  });

  it("returns ok when Stripe account is configured", () => {
    const result = evaluateConnectStepReadiness({
      ...BASE_ROW,
      stripeConnectAccountId: "acct_1",
      stripeConnectPayoutsEnabled: true,
    });
    expect(result).toEqual({ ok: true });
  });
});
