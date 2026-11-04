import { describe, expect, it } from "vitest";
import {
  auditActionLabel,
  auditActor,
  auditDetail,
  auditRecordHref,
  auditRecordLabel,
} from "./audit-log.vm";

describe("an audit event", () => {
  it("reads its action in words, never as a code", () => {
    expect(auditActionLabel("mark_payout_paid")).toBe("Payout marked paid");
    expect(auditActionLabel("editorial.story.publish")).toBe("Story published");
    expect(auditActionLabel("help.category.reorder")).toBe("Help category reordered");
    expect(auditActionLabel("something_new_happened")).toBe("Something new happened");
    expect(auditActionLabel("editorial.preview_token.issue")).toBe("Preview link created");
  });

  it("reads the return and outside-refund actions in words", () => {
    expect(auditActionLabel("refund_settled_outside")).toBe(
      "Refund marked as refunded outside LAX",
    );
    expect(auditActionLabel("return_in_transit")).toBe("Return marked in transit");
    expect(auditActionLabel("return_received")).toBe("Return received");
    expect(auditActionLabel("edition_back_on_sale")).toBe("Print back on sale");
  });

  it("names the record kind, and links to the record when it has a page", () => {
    expect(auditRecordLabel("shop_payout_ledger")).toBe("Payout");
    expect(auditRecordLabel("shop_mystery_box")).toBe("Mystery box");
    expect(auditRecordHref("shop_artwork", "a1")).toBe("/artworks/a1");
    expect(auditRecordHref("editorial_story", "s1")).toBe("/editorial/stories/s1");
    expect(auditRecordHref("shop_payout_ledger", "p1")).toBe("/payouts?payout=p1");
    expect(auditRecordHref("shop_refund", "r1")).toBeNull();
  });

  it("shows the platform as itself and a person by name", () => {
    expect(auditActor({ actorSubjectId: "system:stripe-webhook" })).toEqual({
      name: "Payment provider",
      email: null,
      kind: "system",
      source: "Automated: stripe webhook",
    });
    expect(auditActor({ actorSubjectId: "system:other" }).name).toBe("System");
    expect(
      auditActor({ actorSubjectId: "sub-1", actorName: "Sam Lee", actorEmail: "sam@lax.art" }),
    ).toEqual({ name: "Sam Lee", email: "sam@lax.art", kind: "person", source: null });
    expect(auditActor({ actorSubjectId: "sub-1" }).name).toBe("Former staff member");
  });

  it("reads script and seed actors as System with their source", () => {
    expect(auditActor({ actorSubjectId: "seed:local-admin-staff" })).toEqual({
      name: "System",
      email: null,
      kind: "system",
      source: "Script: local admin staff",
    });
    expect(auditActor({ actorSubjectId: "ops:sam@lax.art" })).toMatchObject({
      name: "System",
      kind: "system",
      source: "Operations script, run by sam@lax.art",
    });
    expect(auditActor({ actorSubjectId: "system:identity-purge" }).name).toBe("LAX scheduler");
  });

  it("lists what changed in words, with ids as copyable facts", () => {
    const detail = auditDetail({
      before: { identitySubjectId: "sub-9", role: "operations", disabledAt: null },
      after: {
        identitySubjectId: "sub-9",
        role: "finance",
        disabledAt: null,
        reason: "Moved team",
        amountPence: 12_500,
      },
    });
    expect(detail.changes).toEqual([{ label: "Role", before: "Operations", after: "Finance" }]);
    expect(detail.facts).toEqual([
      { label: "LAX account ID", value: "sub-9", copyValue: "sub-9" },
      { label: "Reason", value: "Moved team" },
      { label: "Amount", value: "£125.00" },
    ]);
  });
});
