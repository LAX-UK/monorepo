import { describe, expect, it } from "vitest";
import * as adminAccess from "./admin-access.js";
import {
  ADMIN_HOME_ACCESS,
  ARTIST_MERGE_ACCESS,
  ARTIST_REVIEW_ACCESS,
  ARTIST_WRITE_ACCESS,
  AUDIT_DOMAIN_EVENTS_ACCESS,
  CLIENT_ACTIVITY_ACCESS,
  CLIENT_BIDS_ACCESS,
  CLIENT_KYC_ACCESS,
  EMAIL_ADMIN_ACCESS,
  EMAIL_OBSERVABILITY_ACCESS,
  FINANCE_ACCESS,
  INVITATIONS_ACCESS,
  LEGAL_ENTITY_BROWSE_ACCESS,
  LOTS_ACCESS,
  ONBOARDING_QUEUES_ACCESS,
  PAYOUT_REVERSE_ACCESS,
  QR_CODES_ACCESS,
  USERS_DIRECTORY_ACCESS,
  USER_MODERATION_ACCESS,
  USER_PICKER_ACCESS,
  USER_ROLE_MANAGEMENT_ACCESS,
} from "./admin-access.js";
import { userHasAccessTo } from "./role-policy.js";
import type { UserStaffRole } from "./user.js";

function has(
  staffRole: UserStaffRole,
  requirement: Parameters<typeof userHasAccessTo>[2],
): boolean {
  return userHasAccessTo("staff", [staffRole], requirement);
}

describe("admin-access requirements", () => {
  it("USERS_DIRECTORY_ACCESS allows administrator and client_services", () => {
    expect(has("administrator", USERS_DIRECTORY_ACCESS)).toBe(true);
    expect(has("client_services", USERS_DIRECTORY_ACCESS)).toBe(true);
    expect(has("specialist", USERS_DIRECTORY_ACCESS)).toBe(false);
    expect(has("read_only", USERS_DIRECTORY_ACCESS)).toBe(false);
    expect(has("finance", USERS_DIRECTORY_ACCESS)).toBe(false);
  });

  it("CLIENT_BIDS_ACCESS allows client_services only among sample roles", () => {
    expect(has("client_services", CLIENT_BIDS_ACCESS)).toBe(true);
    expect(has("administrator", CLIENT_BIDS_ACCESS)).toBe(true);
    expect(has("saleroom_clerk", CLIENT_BIDS_ACCESS)).toBe(true);
    expect(has("sales_manager", CLIENT_BIDS_ACCESS)).toBe(false);
    expect(has("read_only", CLIENT_BIDS_ACCESS)).toBe(false);
  });

  it("CLIENT_KYC_ACCESS stays platform-admin only (advisors excluded)", () => {
    expect(has("administrator", CLIENT_KYC_ACCESS)).toBe(true);
    expect(has("client_services", CLIENT_KYC_ACCESS)).toBe(false);
    expect(has("read_only", CLIENT_KYC_ACCESS)).toBe(false);
  });

  it("CLIENT_ACTIVITY_ACCESS stays platform-admin only (advisors excluded)", () => {
    expect(has("administrator", CLIENT_ACTIVITY_ACCESS)).toBe(true);
    expect(has("client_services", CLIENT_ACTIVITY_ACCESS)).toBe(false);
    expect(has("read_only", CLIENT_ACTIVITY_ACCESS)).toBe(false);
  });

  it("EMAIL_OBSERVABILITY_ACCESS allows read_only", () => {
    expect(has("read_only", EMAIL_OBSERVABILITY_ACCESS)).toBe(true);
    expect(has("administrator", EMAIL_OBSERVABILITY_ACCESS)).toBe(true);
    expect(has("cataloguer", EMAIL_OBSERVABILITY_ACCESS)).toBe(false);
  });

  it("LEGAL_ENTITY_BROWSE_ACCESS allows read_only and specialist", () => {
    expect(has("read_only", LEGAL_ENTITY_BROWSE_ACCESS)).toBe(true);
    expect(has("specialist", LEGAL_ENTITY_BROWSE_ACCESS)).toBe(true);
    expect(has("finance", LEGAL_ENTITY_BROWSE_ACCESS)).toBe(true);
  });

  it("LOTS_ACCESS denies read_only", () => {
    expect(has("cataloguer", LOTS_ACCESS)).toBe(true);
    expect(has("read_only", LOTS_ACCESS)).toBe(false);
  });

  it("ONBOARDING_QUEUES_ACCESS allows specialist", () => {
    expect(has("specialist", ONBOARDING_QUEUES_ACCESS)).toBe(true);
    expect(has("read_only", ONBOARDING_QUEUES_ACCESS)).toBe(true);
  });

  it("USER_PICKER_ACCESS is narrower than USERS_DIRECTORY_ACCESS", () => {
    expect(has("cataloguer", USER_PICKER_ACCESS)).toBe(true);
    expect(has("cataloguer", USERS_DIRECTORY_ACCESS)).toBe(false);
  });

  it("USER_MODERATION_ACCESS allows client_services", () => {
    expect(has("client_services", USER_MODERATION_ACCESS)).toBe(true);
    expect(has("read_only", USER_MODERATION_ACCESS)).toBe(false);
  });

  it("INVITATIONS_ACCESS allows administrator", () => {
    expect(has("administrator", INVITATIONS_ACCESS)).toBe(true);
    expect(has("specialist", INVITATIONS_ACCESS)).toBe(false);
  });

  it("USER_ROLE_MANAGEMENT_ACCESS matches INVITATIONS_ACCESS", () => {
    expect(has("administrator", USER_ROLE_MANAGEMENT_ACCESS)).toBe(true);
    expect(has("client_services", USER_ROLE_MANAGEMENT_ACCESS)).toBe(false);
  });

  it("FINANCE_ACCESS allows finance only among sample roles", () => {
    expect(has("finance", FINANCE_ACCESS)).toBe(true);
    expect(has("specialist", FINANCE_ACCESS)).toBe(false);
    expect(has("administrator", FINANCE_ACCESS)).toBe(true);
  });

  it("PAYOUT_REVERSE_ACCESS allows administrator", () => {
    expect(has("administrator", PAYOUT_REVERSE_ACCESS)).toBe(true);
    expect(has("finance", PAYOUT_REVERSE_ACCESS)).toBe(false);
  });

  it("ARTIST_WRITE_ACCESS allows cataloguer", () => {
    expect(has("cataloguer", ARTIST_WRITE_ACCESS)).toBe(true);
    expect(has("read_only", ARTIST_WRITE_ACCESS)).toBe(false);
  });

  it("ARTIST_REVIEW_ACCESS allows artist reviewer roles", () => {
    expect(has("cataloguer", ARTIST_REVIEW_ACCESS)).toBe(true);
    expect(has("read_only", ARTIST_REVIEW_ACCESS)).toBe(false);
  });

  it("ARTIST_MERGE_ACCESS denies read_only", () => {
    expect(has("administrator", ARTIST_MERGE_ACCESS)).toBe(true);
    expect(has("read_only", ARTIST_MERGE_ACCESS)).toBe(false);
  });

  it("QR_CODES_ACCESS matches LOTS_ACCESS", () => {
    expect(has("cataloguer", QR_CODES_ACCESS)).toBe(true);
    expect(has("read_only", QR_CODES_ACCESS)).toBe(false);
  });

  it("ADMIN_HOME_ACCESS allows specialist and read_only", () => {
    expect(has("specialist", ADMIN_HOME_ACCESS)).toBe(true);
    expect(has("read_only", ADMIN_HOME_ACCESS)).toBe(true);
  });

  it("EMAIL_ADMIN_ACCESS matches PLATFORM_ADMIN_ACCESS", () => {
    expect(has("administrator", EMAIL_ADMIN_ACCESS)).toBe(true);
    expect(has("specialist", EMAIL_ADMIN_ACCESS)).toBe(false);
  });

  it("AUDIT_DOMAIN_EVENTS_ACCESS allows read_only", () => {
    expect(has("read_only", AUDIT_DOMAIN_EVENTS_ACCESS)).toBe(true);
    expect(has("finance", AUDIT_DOMAIN_EVENTS_ACCESS)).toBe(true);
  });

  const ACCESS_MATRIX: {
    name: keyof typeof adminAccess;
    allowed: UserStaffRole;
    denied: UserStaffRole;
  }[] = [
    { name: "SUBMISSIONS_ACCESS", allowed: "specialist", denied: "read_only" },
    { name: "CONDITION_REPORTS_ACCESS", allowed: "cataloguer", denied: "read_only" },
    { name: "SALES_ACCESS", allowed: "sales_manager", denied: "read_only" },
    { name: "SALE_CATALOG_ACCESS", allowed: "cataloguer", denied: "finance" },
    { name: "ARTISTS_ACCESS", allowed: "specialist", denied: "finance" },
    { name: "ARTIST_DELETE_ACCESS", allowed: "administrator", denied: "read_only" },
    { name: "CATEGORIES_ACCESS", allowed: "cataloguer", denied: "read_only" },
    { name: "VENUES_ACCESS", allowed: "cataloguer", denied: "read_only" },
    { name: "SALEROOM_ACCESS", allowed: "sales_manager", denied: "read_only" },
    { name: "SALEROOM_ACCESS", allowed: "saleroom_clerk", denied: "cataloguer" },
    { name: "LOT_FULFILMENT_ACCESS", allowed: "fulfilment", denied: "read_only" },
    { name: "PLATFORM_ADMIN_ACCESS", allowed: "administrator", denied: "specialist" },
    { name: "EMAIL_OBSERVABILITY_ACCESS", allowed: "read_only", denied: "cataloguer" },
    { name: "CLIENT_BIDS_ACCESS", allowed: "client_services", denied: "fulfilment" },
  ];

  it.each(ACCESS_MATRIX)(
    "$name has documented allow and deny roles",
    ({ name, allowed, denied }) => {
      const requirement = adminAccess[name];
      expect(has(allowed, requirement)).toBe(true);
      expect(has(denied, requirement)).toBe(false);
    },
  );

  describe("admin.read opens pages without actions", () => {
    const PAGES: {
      read: keyof typeof adminAccess;
      write: keyof typeof adminAccess;
      editor: UserStaffRole;
    }[] = [
      { read: "SALES_READ_ACCESS", write: "SALES_ACCESS", editor: "sales_manager" },
      { read: "SALE_CATALOG_READ_ACCESS", write: "SALE_CATALOG_ACCESS", editor: "cataloguer" },
      { read: "LOTS_READ_ACCESS", write: "LOTS_ACCESS", editor: "cataloguer" },
      { read: "SUBMISSIONS_READ_ACCESS", write: "SUBMISSIONS_ACCESS", editor: "specialist" },
      {
        read: "CONDITION_REPORTS_READ_ACCESS",
        write: "CONDITION_REPORTS_ACCESS",
        editor: "cataloguer",
      },
      { read: "CATEGORIES_READ_ACCESS", write: "CATEGORIES_ACCESS", editor: "cataloguer" },
      { read: "VENUES_READ_ACCESS", write: "VENUES_ACCESS", editor: "cataloguer" },
      { read: "QR_CODES_READ_ACCESS", write: "QR_CODES_ACCESS", editor: "cataloguer" },
      { read: "CATALOGUE_READ_ACCESS", write: "CATALOGUE_WRITE_ACCESS", editor: "sales_manager" },
      { read: "LOT_WORK_READ_ACCESS", write: "LOT_WORK_ACCESS", editor: "specialist" },
    ];

    it.each(PAGES)("$read opens for read-only; $write stays closed", ({ read, write, editor }) => {
      expect(has("read_only", adminAccess[read])).toBe(true);
      expect(has("read_only", adminAccess[write])).toBe(false);
      expect(has(editor, adminAccess[read])).toBe(true);
      expect(has(editor, adminAccess[write])).toBe(true);
    });

    it("keeps personal data, money and staff management closed", () => {
      for (const requirement of [
        USERS_DIRECTORY_ACCESS,
        CLIENT_BIDS_ACCESS,
        CLIENT_KYC_ACCESS,
        CLIENT_ACTIVITY_ACCESS,
        FINANCE_ACCESS,
        PAYOUT_REVERSE_ACCESS,
        INVITATIONS_ACCESS,
        USER_MODERATION_ACCESS,
        adminAccess.AML_REVIEW_ACCESS,
        adminAccess.LOT_FULFILMENT_ACCESS,
        adminAccess.SALEROOM_ACCESS,
      ]) {
        expect(has("read_only", requirement)).toBe(false);
      }
    });

    it("readOrWrite adds admin.read to the write rule", () => {
      expect(adminAccess.readOrWrite("auction.manage")).toEqual({
        anyOf: ["auction.manage", "admin.read"],
      });
      expect(adminAccess.readOrWrite({ anyOf: ["catalogue.write", "auction.manage"] })).toEqual({
        anyOf: ["catalogue.write", "auction.manage", "admin.read"],
      });
    });
  });

  describe("saleroom clerk", () => {
    it("runs the saleroom but cannot edit sales or the catalogue", () => {
      expect(has("saleroom_clerk", adminAccess.SALEROOM_ACCESS)).toBe(true);
      expect(has("saleroom_clerk", adminAccess.SALES_ACCESS)).toBe(false);
      expect(has("saleroom_clerk", adminAccess.SALE_CATALOG_ACCESS)).toBe(false);
      expect(has("saleroom_clerk", adminAccess.WITHDRAWAL_DECISION_ACCESS)).toBe(false);
      expect(has("saleroom_clerk", LOTS_ACCESS)).toBe(false);
      expect(has("saleroom_clerk", ADMIN_HOME_ACCESS)).toBe(true);
    });

    it("reads the sale record its console is built on", () => {
      expect(has("saleroom_clerk", adminAccess.SALE_ADMIN_DETAIL_ACCESS)).toBe(true);
      expect(has("read_only", adminAccess.SALE_ADMIN_DETAIL_ACCESS)).toBe(true);
      expect(has("finance", adminAccess.SALE_ADMIN_DETAIL_ACCESS)).toBe(false);
    });
  });
});

describe("consignment inbox", () => {
  const REPLY: UserStaffRole[] = [
    "specialist",
    "client_services",
    "sales_manager",
    "administrator",
  ];
  const READ_ONLY: UserStaffRole[] = [
    "cataloguer",
    "finance",
    "compliance",
    "fulfilment",
    "read_only",
  ];

  it.each(REPLY)("%s reads and replies", (role) => {
    expect(has(role, adminAccess.CONSIGNMENT_INBOX_READ_ACCESS)).toBe(true);
    expect(has(role, adminAccess.CONSIGNMENT_INBOX_REPLY_ACCESS)).toBe(true);
  });

  it.each(READ_ONLY)("%s reads without replying", (role) => {
    expect(has(role, adminAccess.CONSIGNMENT_INBOX_READ_ACCESS)).toBe(true);
    expect(has(role, adminAccess.CONSIGNMENT_INBOX_REPLY_ACCESS)).toBe(false);
  });

  it("keeps the saleroom clerk out", () => {
    expect(has("saleroom_clerk", adminAccess.CONSIGNMENT_INBOX_READ_ACCESS)).toBe(false);
  });

  it("leaves saved replies to sales managers and administrators", () => {
    const managers = [...REPLY, ...READ_ONLY].filter((role) =>
      has(role, adminAccess.CONSIGNMENT_SAVED_REPLIES_MANAGE_ACCESS),
    );
    expect(managers.sort()).toEqual(["administrator", "sales_manager"]);
  });
});
