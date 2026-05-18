import { describe, expect, it } from "vitest";
import {
  isAdminAuditEventType,
  presentAdminUserDomainEvent,
  presentAdminUserSession,
} from "./admin-user-event-presenter";

describe("presentAdminUserDomainEvent", () => {
  it("maps suspension events to danger tone", () => {
    const p = presentAdminUserDomainEvent("auth.account_suspended");
    expect(p.title).toBe("Account suspended");
    expect(p.tone).toBe("negative");
  });

  it("maps kyc events to warning", () => {
    const p = presentAdminUserDomainEvent("kyc.session.completed");
    expect(p.kind).toBe("kyc");
    expect(p.tone).toBe("warning");
  });
});

describe("presentAdminUserSession", () => {
  it("labels sign-in", () => {
    expect(presentAdminUserSession().title).toBe("Signed in");
  });
});

describe("isAdminAuditEventType", () => {
  it("matches auth and admin prefixes", () => {
    expect(isAdminAuditEventType("auth.account_suspended")).toBe(true);
    expect(isAdminAuditEventType("admin.user.updated")).toBe(true);
    expect(isAdminAuditEventType("payment.captured")).toBe(false);
  });
});
