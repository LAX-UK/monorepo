import type { LegalEntitySummary } from "@auction/types";
import { describe, expect, it } from "vitest";
import { sellerAccountChoice } from "./seller-account-options";

function membership(partial: Partial<LegalEntitySummary> & Pick<LegalEntitySummary, "id">) {
  return {
    displayName: "Northbank Gallery",
    kind: "organisation",
    subkind: "gallery",
    status: "approved",
    role: "admin",
    isPrimaryAdmin: false,
    ...partial,
  } as LegalEntitySummary;
}

const personal = membership({
  id: "me",
  kind: "individual",
  subkind: "private_collector",
  displayName: "jane@example.com",
  role: "owner",
});

describe("sellerAccountChoice", () => {
  it("offers only Personal to someone without organisations", () => {
    const choice = sellerAccountChoice({
      memberships: [personal],
      personalName: "Jane Smith",
      actingId: "me",
    });
    expect(choice.options).toEqual([
      expect.objectContaining({ id: "me", kind: "personal", name: "Jane Smith", canSubmit: true }),
    ]);
    expect(choice.defaultId).toBe("me");
  });

  it("lists organisations whose role may submit, Personal first", () => {
    const choice = sellerAccountChoice({
      memberships: [
        membership({ id: "gallery", role: "admin" }),
        membership({ id: "finance-only", role: "finance" }),
        membership({ id: "viewer-only", role: "viewer" }),
        membership({ id: "consigning", role: "consignor", displayName: "Studio" }),
        personal,
      ],
      personalName: "Jane Smith",
      actingId: null,
    });
    expect(choice.options.map((o) => [o.id, o.roleLabel])).toEqual([
      ["me", null],
      ["gallery", "Admin"],
      ["consigning", "Consignor"],
    ]);
    expect(choice.defaultId).toBe("me");
  });

  it("preselects the account in use", () => {
    const choice = sellerAccountChoice({
      memberships: [personal, membership({ id: "gallery" })],
      personalName: "Jane Smith",
      actingId: "gallery",
    });
    expect(choice.defaultId).toBe("gallery");
  });

  it("offers an organisation under review for drafts only, saying why", () => {
    const choice = sellerAccountChoice({
      memberships: [personal, membership({ id: "new", status: "docs_received" })],
      personalName: "Jane Smith",
      actingId: "new",
    });
    const option = choice.options.find((o) => o.id === "new");
    expect(option?.canSubmit).toBe(false);
    expect(option?.submitBlockedReason).toMatch(/still checking/);
  });

  it("leaves out closed organisations and impersonation rows", () => {
    const choice = sellerAccountChoice({
      memberships: [
        personal,
        membership({ id: "closed", status: "archived" }),
        membership({ id: "support", isImpersonation: true }),
      ],
      personalName: "Jane Smith",
      actingId: null,
    });
    expect(choice.options.map((o) => o.id)).toEqual(["me"]);
  });
});
