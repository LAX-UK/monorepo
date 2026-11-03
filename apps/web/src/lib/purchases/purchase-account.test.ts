import type { ScopedAccount } from "@/lib/account-scope/account-scope";
import { describe, expect, it } from "vitest";
import { purchaseRequestAccountId } from "./purchase-account";

const organisation = {
  kind: "organisation",
  id: "org-1",
  name: "Org",
  actor: { role: "owner", isImpersonation: false },
} as ScopedAccount;
const personal: ScopedAccount = { kind: "personal", id: "person-1" };
const personalUnknown: ScopedAccount = { kind: "personal", id: null };

describe("purchaseRequestAccountId", () => {
  it("leaves pay several and delivery quotes as they were: a person's account is not named", () => {
    expect(purchaseRequestAccountId(personal)).toBeNull();
    expect(purchaseRequestAccountId(personalUnknown)).toBeNull();
    expect(purchaseRequestAccountId(organisation)).toBe("org-1");
  });

  it("names a person's own account only when asked", () => {
    expect(purchaseRequestAccountId(personal, { includePersonal: true })).toBe("person-1");
    expect(purchaseRequestAccountId(personalUnknown, { includePersonal: true })).toBeNull();
    expect(purchaseRequestAccountId(organisation, { includePersonal: true })).toBe("org-1");
  });
});
