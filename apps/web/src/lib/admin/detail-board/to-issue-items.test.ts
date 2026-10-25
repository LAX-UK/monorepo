import { describe, expect, it } from "vitest";
import { toIssueItems } from "./to-issue-items";

describe("toIssueItems", () => {
  it("maps severity to a tone and keeps the fix link only when there is one", () => {
    expect(
      toIssueItems([
        {
          id: "a",
          title: "No photos",
          count: 1,
          category: "Setup",
          severity: "critical",
          actionLabel: "Add photos",
          href: "/admin/lots/l1/images",
        },
        {
          id: "b",
          title: "Reserve below estimate",
          count: 1,
          category: "Pricing",
          severity: "low",
          actionLabel: "Review",
        },
      ]),
    ).toEqual([
      {
        id: "a",
        label: "No photos",
        tone: "danger",
        tag: "Setup",
        action: { label: "Add photos", href: "/admin/lots/l1/images" },
      },
      { id: "b", label: "Reserve below estimate", tone: "neutral", tag: "Pricing" },
    ]);
  });
});
