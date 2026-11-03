import { describe, expect, it } from "vitest";
import {
  type EmailChangeDraft,
  emailChangeAccessFor,
  emailChangeBlockedReason,
  kycMatchAvailable,
  toEmailChangeBody,
  validateEmailChange,
} from "./staff-email-change";

const REASON = "Lost the old mailbox; caller matched the KYC record.";

const KYC_DRAFT: EmailChangeDraft = {
  newEmail: "New@Example.com",
  currentEmail: "old@example.com",
  reason: REASON,
  proofKind: "kyc_match",
  kycSessionId: "kyc-1",
  kycConfirmed: true,
  reference: "",
};
const ID_DRAFT: EmailChangeDraft = {
  ...KYC_DRAFT,
  proofKind: "id_check",
  kycSessionId: null,
  kycConfirmed: false,
  reference: "IDV-2291",
};

describe("who may change an email", () => {
  it("opens it to client services and Administrator, and to nobody else", () => {
    const viewer = (staffRoles: string[]) =>
      emailChangeAccessFor({ id: "v", role: "staff", staffRoles: staffRoles as never });
    expect(viewer(["client_services"]).canChange).toBe(true);
    expect(viewer(["administrator"]).canChange).toBe(true);
    for (const role of ["finance", "fulfilment", "compliance", "specialist", "read_only"]) {
      expect(viewer([role]).canChange).toBe(false);
    }
    expect(emailChangeAccessFor({ id: "v", role: "client", staffRoles: [] }).canChange).toBe(false);
    expect(emailChangeAccessFor(null).canChange).toBe(false);
  });

  it("lets only an Administrator move a staff account", () => {
    const support = emailChangeAccessFor({
      id: "s",
      role: "staff",
      staffRoles: ["client_services"],
    });
    const admin = emailChangeAccessFor({ id: "a", role: "staff", staffRoles: ["administrator"] });
    expect(emailChangeBlockedReason(support, { id: "p", role: "staff" })).toMatch(/Administrator/);
    expect(emailChangeBlockedReason(admin, { id: "p", role: "staff" })).toBeNull();
    expect(emailChangeBlockedReason(support, { id: "p", role: "client" })).toBeNull();
  });

  it("never lets anyone change their own address here", () => {
    const admin = emailChangeAccessFor({ id: "a", role: "staff", staffRoles: ["administrator"] });
    expect(emailChangeBlockedReason(admin, { id: "a", role: "staff" })).toMatch(/LAX Account/);
  });

  it("offers a KYC match only after an approved identity check", () => {
    expect(kycMatchAvailable("approved")).toBe(true);
    for (const status of ["unverified", "pending", "rejected", "expired"]) {
      expect(kycMatchAvailable(status)).toBe(false);
    }
  });
});

describe("validateEmailChange", () => {
  it("accepts a complete KYC match and a complete fresh ID check", () => {
    expect(validateEmailChange(KYC_DRAFT)).toEqual({});
    expect(validateEmailChange(ID_DRAFT)).toEqual({});
  });

  it("asks for each missing piece by name", () => {
    const errors = validateEmailChange({
      ...KYC_DRAFT,
      newEmail: "",
      reason: "short",
      proofKind: null,
    });
    expect(Object.keys(errors).sort()).toEqual(["newEmail", "proof", "reason"]);
  });

  it("rejects a malformed address and the account's own", () => {
    expect(validateEmailChange({ ...KYC_DRAFT, newEmail: "nope" }).newEmail).toMatch(/valid/);
    expect(validateEmailChange({ ...KYC_DRAFT, newEmail: " OLD@example.com " }).newEmail).toMatch(
      /already/,
    );
  });

  it("needs the reference of a fresh ID check", () => {
    expect(validateEmailChange({ ...ID_DRAFT, reference: " " }).reference).toBeDefined();
  });

  it("needs staff to confirm the match, and a record to match", () => {
    expect(validateEmailChange({ ...KYC_DRAFT, kycConfirmed: false }).kycConfirmed).toBeDefined();
    expect(validateEmailChange({ ...KYC_DRAFT, kycSessionId: null }).proof).toBeDefined();
  });
});

describe("toEmailChangeBody", () => {
  it("normalises the address and carries the KYC session", () => {
    expect(toEmailChangeBody(KYC_DRAFT)).toEqual({
      newEmail: "new@example.com",
      reason: REASON,
      proof: { kind: "kyc_match", kycSessionId: "kyc-1" },
    });
  });

  it("carries the ID check reference", () => {
    expect(toEmailChangeBody(ID_DRAFT)?.proof).toEqual({ kind: "id_check", reference: "IDV-2291" });
  });
});
