import { describe, expect, it } from "vitest";
import { nextStatusForLifecycleOp } from "./legal-entity-lifecycle-transitions.js";

describe("nextStatusForLifecycleOp", () => {
  it("request_docs from lead and post-submission review states", () => {
    expect(nextStatusForLifecycleOp("lead", "request_docs")).toEqual({
      next: "docs_requested",
      requiresReason: false,
    });
    expect(nextStatusForLifecycleOp("docs_received", "request_docs")).toEqual({
      next: "docs_requested",
      requiresReason: false,
    });
    expect(nextStatusForLifecycleOp("under_review", "request_docs")).toEqual({
      next: "docs_requested",
      requiresReason: false,
    });
    expect(nextStatusForLifecycleOp("approved", "request_docs")).toBeNull();
  });

  it("approve only from under_review", () => {
    expect(nextStatusForLifecycleOp("under_review", "approve")).toEqual({
      next: "connect_pending",
      requiresReason: false,
    });
    expect(nextStatusForLifecycleOp("lead", "approve")).toBeNull();
  });

  it("reject requires reason flag and rejects terminal states", () => {
    expect(nextStatusForLifecycleOp("approved", "reject")).toEqual({
      next: "rejected",
      requiresReason: true,
    });
    expect(nextStatusForLifecycleOp("rejected", "reject")).toBeNull();
    expect(nextStatusForLifecycleOp("archived", "reject")).toBeNull();
  });

  it("archive from non-archived requires reason", () => {
    expect(nextStatusForLifecycleOp("rejected", "archive")).toEqual({
      next: "archived",
      requiresReason: true,
    });
    expect(nextStatusForLifecycleOp("archived", "archive")).toBeNull();
  });
});
