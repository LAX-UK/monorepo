import { describe, expect, it } from "vitest";
import { notificationHref } from "./notification-link";

describe("notificationHref", () => {
  it("prefers submission detail over lot page", () => {
    expect(
      notificationHref({
        id: "n1",
        userId: "u1",
        type: "submission_approved",
        title: "Accepted",
        message: "Body",
        lotId: "lot-1",
        submissionId: "sub-1",
        read: false,
        createdAt: new Date(),
      }),
    ).toBe("/dashboard/submissions/sub-1");
  });

  it("routes staff submission notifications to admin detail", () => {
    expect(
      notificationHref({
        id: "n3",
        userId: "staff-1",
        type: "submission_received_for_review",
        title: "New submission",
        message: "Body",
        lotId: null,
        submissionId: "sub-staff",
        read: false,
        createdAt: new Date(),
      }),
    ).toBe("/admin/submissions/sub-staff");
  });

  it("falls back to lot path when only lotId is set", () => {
    const href = notificationHref({
      id: "n2",
      userId: "u1",
      type: "lot_won",
      title: "Hammer",
      message: "Body",
      lotId: "00000000-0000-4000-8000-000000000099",
      submissionId: null,
      read: true,
      createdAt: new Date(),
    });
    expect(href).toContain("/lot/");
    expect(href).toContain("00000000-0000-4000-8000-000000000099");
  });
});
