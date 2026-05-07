import { describe, expect, it } from "vitest";
import { redactDomainEventPayload } from "./domain-event-pii.js";

describe("redactDomainEventPayload", () => {
  it("minimises unknown event types by default (strings redacted, ids kept)", () => {
    const out = redactDomainEventPayload("bid.placed", {
      bidId: "b1",
      lotId: "l1",
      userId: "u1",
      amountCents: 500,
      note: "call me on 555",
    }) as Record<string, unknown>;
    expect(out.bidId).toBe("b1");
    expect(out.amountCents).toBe(500);
    expect(out.note).toBe("[REDACTED]");
  });

  it("allows email for legal_entity.member_invited", () => {
    const out = redactDomainEventPayload("legal_entity.member_invited", {
      legalEntityId: "le1",
      email: "invitee@example.com",
      message: "welcome",
    }) as Record<string, unknown>;
    expect(out.email).toBe("invitee@example.com");
    expect(out.message).toBe("[REDACTED]");
  });

  it("allows buyer name and email for payment.captured", () => {
    const out = redactDomainEventPayload("payment.captured", {
      paymentId: "p1",
      buyerName: "Jane Doe",
      buyerEmail: "jane@example.com",
      secretNote: "internal",
    }) as Record<string, unknown>;
    expect(out.paymentId).toBe("p1");
    expect(out.buyerName).toBe("Jane Doe");
    expect(out.buyerEmail).toBe("jane@example.com");
    expect(out.secretNote).toBe("[REDACTED]");
  });

  it("allows verified identity fields for kyc.verified recursively", () => {
    const out = redactDomainEventPayload("kyc.verified", {
      userId: "u1",
      verified: {
        firstName: "Jane",
        lastName: "Doe",
        dateOfBirth: "1990-01-01",
        rawDocument: "passport-scan-bytes",
      },
    }) as Record<string, unknown>;
    expect(out.userId).toBe("u1");
    const v = out.verified as Record<string, unknown>;
    expect(v.firstName).toBe("Jane");
    expect(v.lastName).toBe("Doe");
    expect(v.dateOfBirth).toBe("1990-01-01");
    expect(v.rawDocument).toBe("[REDACTED]");
  });

  it("bypasses all redaction when includePii is true (audit.read_pii)", () => {
    const payload = { email: "x@y.com", note: "n" };
    expect(redactDomainEventPayload("user.registered", payload, { includePii: true })).toEqual(
      payload,
    );
  });

  it("allows cookie_cleared_after_failed_end in admin.impersonation_ended end_reason", () => {
    const out = redactDomainEventPayload("admin.impersonation_ended", {
      session_id: "s1",
      end_reason: "cookie_cleared_after_failed_end",
    }) as Record<string, unknown>;
    expect(out.session_id).toBe("s1");
    expect(out.end_reason).toBe("cookie_cleared_after_failed_end");
  });

  it("allows timeout_swept in admin.impersonation_ended end_reason", () => {
    const out = redactDomainEventPayload("admin.impersonation_ended", {
      session_id: "s1",
      end_reason: "timeout_swept",
    }) as Record<string, unknown>;
    expect(out.end_reason).toBe("timeout_swept");
  });

  it("allows legal_entity.member_removed payload fields", () => {
    const out = redactDomainEventPayload("legal_entity.member_removed", {
      member_user_id: "u1",
      removed_by_user_id: "u2",
      role_at_removal: "admin",
      reason: null,
      secret: "x",
    }) as Record<string, unknown>;
    expect(out.member_user_id).toBe("u1");
    expect(out.removed_by_user_id).toBe("u2");
    expect(out.role_at_removal).toBe("admin");
    expect(out.reason).toBe(null);
    expect(out.secret).toBe("[REDACTED]");
  });

  const seP17LifecycleTypes = [
    "legal_entity.docs_requested",
    "legal_entity.review_started",
    "legal_entity.approved",
    "legal_entity.restricted",
    "legal_entity.rejected",
    "legal_entity.archived",
  ] as const;

  it.each(seP17LifecycleTypes)(
    "allows from_status, to_status, reason for %s",
    (eventType) => {
      const out = redactDomainEventPayload(eventType, {
        from_status: "lead",
        to_status: "docs_requested",
        reason: "audit note",
        extra: "secret",
      }) as Record<string, unknown>;
      expect(out.from_status).toBe("lead");
      expect(out.to_status).toBe("docs_requested");
      expect(out.reason).toBe("audit note");
      expect(out.extra).toBe("[REDACTED]");
    },
  );

  it("allows entity display name and session id for admin.impersonation_started", () => {
    const out = redactDomainEventPayload("admin.impersonation_started", {
      impersonating_user_id: "u1",
      target_legal_entity_id: "le1",
      target_legal_entity_display_name: "Acme Gallery",
      session_id: "s1",
      expires_at: "2026-01-01T00:00:00.000Z",
      internalNote: "secret",
    }) as Record<string, unknown>;
    expect(out.impersonating_user_id).toBe("u1");
    expect(out.target_legal_entity_id).toBe("le1");
    expect(out.target_legal_entity_display_name).toBe("Acme Gallery");
    expect(out.session_id).toBe("s1");
    expect(out.expires_at).toBe("2026-01-01T00:00:00.000Z");
    expect(out.internalNote).toBe("[REDACTED]");
  });
});
