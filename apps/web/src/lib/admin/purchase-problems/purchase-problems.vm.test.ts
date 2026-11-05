import { PURCHASE_PROBLEM_CATEGORIES, PURCHASE_PROBLEM_STATUSES } from "@auction/domain";
import { describe, expect, it } from "vitest";
import {
  PURCHASE_PROBLEM_CATEGORY_LABELS,
  PURCHASE_PROBLEM_EMPTY_COPY,
  PURCHASE_PROBLEM_STATUS_BADGES,
  PURCHASE_PROBLEM_STATUS_LABELS,
  lotLabel,
  paymentStateLabel,
  purchaseProblemTabs,
  purchaseProblemsSummary,
} from "./purchase-problems.vm";

describe("vocabularies", () => {
  it("name every status and category the domain has, in sentence case", () => {
    for (const status of PURCHASE_PROBLEM_STATUSES) {
      expect(PURCHASE_PROBLEM_STATUS_LABELS[status]).toMatch(/^[A-Z][a-z ]+$/);
      expect(PURCHASE_PROBLEM_STATUS_BADGES[status].tone).toBeDefined();
      expect(PURCHASE_PROBLEM_EMPTY_COPY[status].title).not.toBe("");
    }
    for (const category of PURCHASE_PROBLEM_CATEGORIES) {
      expect(PURCHASE_PROBLEM_CATEGORY_LABELS[category]).not.toMatch(/_/);
    }
  });

  it("never lets two statuses share a badge look", () => {
    const looks = PURCHASE_PROBLEM_STATUSES.map(
      (status) =>
        `${PURCHASE_PROBLEM_STATUS_BADGES[status].tone}/${PURCHASE_PROBLEM_STATUS_BADGES[status].shape}`,
    );
    expect(new Set(looks).size).toBe(looks.length);
  });
});

describe("purchaseProblemTabs", () => {
  it("lists Open, In progress and Resolved with their counts", () => {
    expect(purchaseProblemTabs({ open: 3, in_progress: 1, resolved: 12 })).toEqual([
      { id: "open", label: "Open", count: 3 },
      { id: "in_progress", label: "In progress", count: 1 },
      { id: "resolved", label: "Resolved", count: 12 },
    ]);
  });

  it("shows zero counts while the list could not be loaded", () => {
    expect(purchaseProblemTabs(null).map((tab) => tab.count)).toEqual([0, 0, 0]);
  });
});

describe("lotLabel and paymentStateLabel", () => {
  it("puts the lot number under the title, and leaves it out for an unnumbered lot", () => {
    expect(lotLabel({ title: "Pool study", lotNumber: 12 })).toEqual({
      primary: "Pool study",
      secondary: "Lot 12",
    });
    expect(lotLabel({ title: "Pool study", lotNumber: null }).secondary).toBeNull();
  });

  it("words the payment state", () => {
    expect(paymentStateLabel("captured")).toBe("Paid");
    expect(paymentStateLabel("requires_manual_review")).toBe("Held for review");
    expect(paymentStateLabel("something_new")).toBe("Unknown");
  });
});

describe("purchaseProblemsSummary", () => {
  it("counts a single page, and gives the range on later pages", () => {
    expect(purchaseProblemsSummary({ page: 1, pageSize: 25, total: 1, itemCount: 1 })).toBe(
      "1 report",
    );
    expect(purchaseProblemsSummary({ page: 1, pageSize: 25, total: 12, itemCount: 12 })).toBe(
      "12 reports",
    );
    expect(purchaseProblemsSummary({ page: 2, pageSize: 25, total: 61, itemCount: 25 })).toBe(
      "26–50 of 61 reports",
    );
  });

  it("says nothing for an empty page", () => {
    expect(purchaseProblemsSummary({ page: 1, pageSize: 25, total: 0, itemCount: 0 })).toBeNull();
  });
});
