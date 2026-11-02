import { describe, expect, it } from "vitest";
import { diffEnquiryRouting, resolveEnquiryAssignee } from "./marketing-enquiry-routing.js";
import { canViewEnquiry } from "./marketing-enquiry-visibility.js";

const rules = [
  { departmentSlug: "paintings", assignedToUserId: "sofia" },
  { departmentSlug: null, assignedToUserId: "tom" },
];

describe("resolveEnquiryAssignee", () => {
  it("uses the department's rule", () => {
    expect(resolveEnquiryAssignee(rules, "paintings")).toBe("sofia");
  });
  it("falls back when the department has no rule or none is named", () => {
    expect(resolveEnquiryAssignee(rules, "prints")).toBe("tom");
    expect(resolveEnquiryAssignee(rules, null)).toBe("tom");
  });
  it("leaves the enquiry unassigned when there is no fallback", () => {
    expect(resolveEnquiryAssignee(rules.slice(0, 1), "prints")).toBeNull();
    expect(resolveEnquiryAssignee([], null)).toBeNull();
  });
});

describe("canViewEnquiry", () => {
  const viewer = { userId: "u1", readsGeneral: false, readsPrivateSale: false };
  it("hides private sale enquiries from roles that do not read them, even when assigned", () => {
    expect(canViewEnquiry({ intent: "private_sale_sell", assignedToUserId: "u1" }, viewer)).toBe(
      false,
    );
    expect(
      canViewEnquiry(
        { intent: "private_sale_buy", assignedToUserId: null },
        { ...viewer, readsPrivateSale: true },
      ),
    ).toBe(true);
  });
  it("shows general enquiries to general readers and to the assignee", () => {
    expect(canViewEnquiry({ intent: "press", assignedToUserId: null }, viewer)).toBe(false);
    expect(canViewEnquiry({ intent: "press", assignedToUserId: "u1" }, viewer)).toBe(true);
    expect(
      canViewEnquiry(
        { intent: "general", assignedToUserId: null },
        { ...viewer, readsGeneral: true },
      ),
    ).toBe(true);
  });
});

describe("diffEnquiryRouting", () => {
  it("reports added, reassigned and removed rules, and nothing for unchanged ones", () => {
    const next = [
      { departmentSlug: "paintings", assignedToUserId: "ben" },
      { departmentSlug: "prints", assignedToUserId: "ann" },
    ];
    expect(diffEnquiryRouting(rules, next)).toEqual([
      { departmentSlug: "paintings", assignedToUserId: "ben", previousAssignedToUserId: "sofia" },
      { departmentSlug: "prints", assignedToUserId: "ann", previousAssignedToUserId: null },
      { departmentSlug: null, assignedToUserId: null, previousAssignedToUserId: "tom" },
    ]);
    expect(diffEnquiryRouting(rules, rules)).toEqual([]);
  });
});
