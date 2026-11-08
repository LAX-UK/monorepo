import { describe, expect, it } from "vitest";
import {
  DANGEROUS_STAFF_ACTIONS,
  REQUIRED_DANGEROUS_CATEGORIES,
  UNROUTED_DANGEROUS_CATEGORIES,
  findDangerousStaffAction,
} from "./dangerous-staff-actions.js";

const concrete = (path: string) => path.replace(/:[A-Za-z]+/g, "abc-123");

describe("dangerous staff action registry", () => {
  it("covers every dangerous category the audit named, or says why it has no route", () => {
    for (const category of REQUIRED_DANGEROUS_CATEGORIES) {
      const listed = DANGEROUS_STAFF_ACTIONS.some((action) => action.category === category);
      expect(listed || UNROUTED_DANGEROUS_CATEGORIES.has(category), category).toBe(true);
    }
  });

  it("has unique ids and unique method + path pairs", () => {
    const ids = DANGEROUS_STAFF_ACTIONS.map((action) => action.id);
    expect(new Set(ids).size).toBe(ids.length);
    const routes = DANGEROUS_STAFF_ACTIONS.map((action) => `${action.method} ${action.path}`);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it("resolves every entry to itself from a concrete request", () => {
    for (const action of DANGEROUS_STAFF_ACTIONS) {
      expect(findDangerousStaffAction(action.method, concrete(action.path))?.id).toBe(action.id);
    }
  });

  it("includes the money, erasure, KYC and role actions by name", () => {
    const ids = new Set(DANGEROUS_STAFF_ACTIONS.map((action) => action.id));
    for (const id of [
      "payment.refund-buyer",
      "payout.reverse",
      "staff.roles.add",
      "data-request.enquiry-erasure",
      "aml.decide",
      "sof.decide",
      "legal-entity.approve",
      "registration.bid-limit",
    ]) {
      expect(ids.has(id), id).toBe(true);
    }
  });

  it("ignores reads and unlisted routes, and a different verb on a listed path", () => {
    expect(findDangerousStaffAction("GET", "/admin/payments/abc/refund-buyer")).toBeNull();
    expect(findDangerousStaffAction("POST", "/admin/saved-views/order")).toBeNull();
    expect(findDangerousStaffAction("POST", "/admin/payments/abc/refund-buyer/extra")).toBeNull();
  });
});
