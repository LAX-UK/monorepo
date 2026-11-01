import { describe, expect, it } from "vitest";
import { notificationHref } from "./notification-link";

describe("notificationHref", () => {
  it("opens a message on its thread: the account's Messages tab, or Bid admin for staff", () => {
    const base = {
      id: "n9",
      userId: "u1",
      type: "consignment_message",
      title: "Reply from Clara Mendes",
      message: "Body",
      lotId: null,
      submissionId: "sub-9",
      read: false,
      createdAt: new Date(),
    };
    expect(notificationHref({ ...base, legalEntityId: "acct" })).toBe(
      "/selling/consignments/sub-9?tab=messages",
    );
    expect(notificationHref({ ...base, legalEntityId: null })).toBe("/admin/submissions/sub-9");
  });

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
    ).toBe("/selling/consignments/sub-1");
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

  it("sends an administrator's ended-role notice to staff access", () => {
    const base = {
      id: "n4",
      userId: "admin-1",
      title: "A staff role has ended",
      message: "Body",
      lotId: null,
      submissionId: null,
      read: false,
      createdAt: new Date(),
    };
    expect(notificationHref({ ...base, type: "staff_role_expired_admin" })).toBe(
      "/admin/staff/access",
    );
    expect(notificationHref({ ...base, type: "staff_role_expired" })).toBeNull();
    expect(notificationHref({ ...base, type: "staff_role_changed_admin" })).toBe(
      "/admin/staff/access",
    );
    expect(notificationHref({ ...base, type: "staff_role_changed" })).toBeNull();
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

describe("notificationHref for delivery notices", () => {
  it.each(["lot_ready_for_collection", "lot_shipped", "lot_delivered"])(
    "opens purchases for %s",
    (type) => {
      expect(
        notificationHref({
          id: "n9",
          userId: "u1",
          type,
          title: "Your lot",
          message: "Body",
          lotId: "lot-1",
          submissionId: null,
          read: false,
          createdAt: new Date(),
        }),
      ).toBe("/purchases");
    },
  );
});
