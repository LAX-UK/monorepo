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
  it("names the account in use, a person's own included", () => {
    expect(purchaseRequestAccountId(personal)).toBe("person-1");
    expect(purchaseRequestAccountId(organisation)).toBe("org-1");
  });

  it("names nothing while a person's own account is not known", () => {
    expect(purchaseRequestAccountId(personalUnknown)).toBeNull();
  });
});
