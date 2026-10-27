import type { LegalEntitySummary } from "@auction/types";
import { describe, expect, it } from "vitest";
import { RecordAccountService } from "./record-account.service.js";

const PERSONAL = "00000000-0000-4000-8000-000000000001";
const GALLERY = "00000000-0000-4000-8000-000000000002";
const OTHER = "00000000-0000-4000-8000-000000000003";

function account(id: string, kind: LegalEntitySummary["kind"]): LegalEntitySummary {
  return {
    id,
    displayName: id,
    kind,
    subkind: kind === "organisation" ? "gallery" : "private_collector",
    status: "approved",
    role: "admin",
    isPrimaryAdmin: false,
  };
}

function service(owner: string | null, organisationsEnabled = true) {
  return new RecordAccountService({
    accounts: {
      listActiveMembershipsForUser: async () => [
        account(PERSONAL, "individual"),
        account(GALLERY, "organisation"),
      ],
    },
    records: { findOwningAccount: async () => owner },
    organisationsEnabled: () => organisationsEnabled,
  });
}

describe("RecordAccountService", () => {
  it("names the organisation a member's consignment belongs to", async () => {
    await expect(service(GALLERY).accountFor("u1", "consignment", "s1")).resolves.toEqual({
      kind: "ok",
      legalEntityId: GALLERY,
    });
  });

  it("names the personal account for a person's own purchase", async () => {
    await expect(service(PERSONAL).accountFor("u1", "purchase", "l1")).resolves.toEqual({
      kind: "ok",
      legalEntityId: PERSONAL,
    });
  });

  it("refuses a record of an organisation the person is not in, without naming it", async () => {
    await expect(service(OTHER).accountFor("u1", "consignment", "s1")).resolves.toEqual({
      kind: "no_access",
    });
  });

  it("refuses organisation records while organisations are switched off", async () => {
    await expect(service(GALLERY, false).accountFor("u1", "consignment", "s1")).resolves.toEqual({
      kind: "no_access",
    });
  });

  it("reports a record that does not exist", async () => {
    await expect(service(null).accountFor("u1", "purchase", "l1")).resolves.toEqual({
      kind: "not_found",
    });
  });
});
