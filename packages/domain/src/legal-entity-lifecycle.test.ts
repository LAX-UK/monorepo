import type { LegalEntityStatus } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  type LifecycleAdminOp,
  nextStatusForLifecycleOp,
  nextStatusForSelfOp,
} from "./legal-entity-lifecycle.js";

const STATUSES = [
  "lead",
  "docs_requested",
  "docs_received",
  "under_review",
  "connect_pending",
  "approved",
  "restricted",
  "rejected",
  "archived",
] as const satisfies readonly LegalEntityStatus[];

const OPS = [
  "request_docs",
  "start_review",
  "approve",
  "restrict",
  "lift_restriction",
  "reject",
  "archive",
] as const satisfies readonly LifecycleAdminOp[];

type Expected = { next: LegalEntityStatus; requiresReason: boolean };

/** Every allowed (op, status) pair; anything not listed must be refused. */
const ALLOWED: Record<LifecycleAdminOp, Partial<Record<LegalEntityStatus, Expected>>> = {
  request_docs: {
    lead: { next: "docs_requested", requiresReason: false },
    docs_received: { next: "docs_requested", requiresReason: false },
    under_review: { next: "docs_requested", requiresReason: false },
  },
  start_review: { docs_received: { next: "under_review", requiresReason: false } },
  approve: { under_review: { next: "connect_pending", requiresReason: false } },
  restrict: { approved: { next: "restricted", requiresReason: true } },
  lift_restriction: { restricted: { next: "connect_pending", requiresReason: true } },
  reject: Object.fromEntries(
    STATUSES.filter((s) => s !== "rejected" && s !== "archived").map((s) => [
      s,
      { next: "rejected", requiresReason: true },
    ]),
  ),
  archive: Object.fromEntries(
    STATUSES.filter((s) => s !== "archived").map((s) => [
      s,
      { next: "archived", requiresReason: true },
    ]),
  ),
};

describe("nextStatusForLifecycleOp", () => {
  for (const op of OPS) {
    for (const status of STATUSES) {
      const expected = ALLOWED[op][status] ?? null;
      it(`${op} from ${status} is ${expected ? `allowed to ${expected.next}` : "refused"}`, () => {
        expect(nextStatusForLifecycleOp(status, op)).toEqual(expected);
      });
    }
  }

  it("refuses an unknown op", () => {
    expect(nextStatusForLifecycleOp("approved", "nope" as LifecycleAdminOp)).toBeNull();
  });
});

describe("lift_restriction", () => {
  it("returns to approved when Connect is ready", () => {
    expect(
      nextStatusForLifecycleOp("restricted", "lift_restriction", { connectReady: true }),
    ).toEqual({ next: "approved", requiresReason: true });
  });

  it("waits in connect_pending when Connect is not ready", () => {
    for (const context of [{ connectReady: false }, {}]) {
      expect(nextStatusForLifecycleOp("restricted", "lift_restriction", context)).toEqual({
        next: "connect_pending",
        requiresReason: true,
      });
    }
  });

  it("ignores Connect readiness when the entity is not restricted", () => {
    expect(
      nextStatusForLifecycleOp("approved", "lift_restriction", { connectReady: true }),
    ).toBeNull();
  });
});

describe("nextStatusForSelfOp", () => {
  it.each(STATUSES)("submit_for_review from %s", (status) => {
    const allowed = status === "lead" || status === "docs_requested";
    expect(nextStatusForSelfOp(status, "submit_for_review")).toBe(allowed ? "docs_received" : null);
  });
});
