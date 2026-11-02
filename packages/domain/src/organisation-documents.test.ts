import { legalEntityMemberRoles, legalEntityStatuses } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  type ReceivedOrganisationDocument,
  organisationDocumentItems,
  organisationDocumentState,
  organisationDocumentsSendable,
} from "./organisation-documents.js";

const doc = (
  id: string,
  kind: string,
  reviewStatus: ReceivedOrganisationDocument["reviewStatus"],
  label: string | null = null,
): ReceivedOrganisationDocument => ({ id, kind, label, reviewStatus });

describe("organisationDocumentState", () => {
  it("is requested until a copy is received", () => {
    expect(organisationDocumentState(null, "docs_requested")).toBe("requested");
  });

  it("is accepted for an approved organisation, whose check has passed", () => {
    expect(organisationDocumentState(null, "approved")).toBe("accepted");
  });

  it.each([
    ["pending", "docs_requested", "received"],
    ["pending", "lead", "received"],
    ["pending", "docs_received", "in_review"],
    ["pending", "under_review", "in_review"],
    ["approved", "under_review", "accepted"],
    ["approved", "approved", "accepted"],
    ["rejected", "docs_requested", "needs_replacing"],
    ["rejected", "under_review", "needs_replacing"],
  ] as const)("%s while %s is %s", (reviewStatus, status, expected) => {
    expect(organisationDocumentState({ reviewStatus }, status)).toBe(expected);
  });
});

describe("organisationDocumentItems", () => {
  it("lists every requested document in order, with what was received for it", () => {
    const items = organisationDocumentItems(
      [{ kind: "companies_house_extract" }, { kind: "vat_certificate" }],
      [doc("d1", "vat_certificate", "rejected")],
      "docs_requested",
    );
    expect(items.map((item) => [item.requested.kind, item.state])).toEqual([
      ["companies_house_extract", "requested"],
      ["vat_certificate", "needs_replacing"],
    ]);
  });

  it("counts the latest copy when a document was replaced", () => {
    const [item] = organisationDocumentItems(
      [{ kind: "vat_certificate" }],
      [doc("old", "vat_certificate", "rejected"), doc("new", "vat_certificate", "pending")],
      "docs_requested",
    );
    expect(item?.received?.id).toBe("new");
    expect(item?.state).toBe("received");
  });

  it("tells labelled documents of the same kind apart", () => {
    const items = organisationDocumentItems(
      [
        { kind: "other", label: "Probate document" },
        { kind: "other", label: "Executor ID" },
      ],
      [doc("d1", "other", "approved", "Executor ID")],
      "under_review",
    );
    expect(items.map((item) => item.state)).toEqual(["requested", "accepted"]);
  });

  it("keeps documents sent beyond what was asked for, after the requested ones", () => {
    const items = organisationDocumentItems(
      [{ kind: "vat_certificate" }],
      [doc("d1", "bank_statement", "pending"), doc("d2", "vat_certificate", "pending")],
      "under_review",
    );
    expect(items.map((item) => [item.requested.kind, item.state])).toEqual([
      ["vat_certificate", "in_review"],
      ["bank_statement", "in_review"],
    ]);
  });

  it("is empty when nothing is asked for or sent", () => {
    expect(organisationDocumentItems([], [], "approved")).toEqual([]);
  });
});

describe("organisationDocumentsSendable", () => {
  const SENDERS = new Set(["owner", "admin"]);
  const OPEN = new Set(["lead", "docs_requested"]);
  const rows = legalEntityMemberRoles.flatMap((role) =>
    legalEntityStatuses.map((status) => [role, status] as const),
  );

  it.each(rows)("%s while %s", (role, status) => {
    expect(organisationDocumentsSendable({ role }, status)).toBe(
      SENDERS.has(role) && OPEN.has(status),
    );
  });

  it("never lets support staff viewing as the organisation send documents", () => {
    expect(
      organisationDocumentsSendable({ role: "owner", isImpersonation: true }, "docs_requested"),
    ).toBe(false);
  });
});
