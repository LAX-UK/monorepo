import { legalEntityMemberRoles } from "@auction/types";
import type { LegalEntityMemberRole, LegalEntityStatus } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  type OrganisationDocumentRecord,
  buildOrganisationDocumentsView,
} from "./organisation-documents.vm";

const SLOTS = [
  { kind: "companies_house_extract", title: "Companies House extract" },
  { kind: "vat_certificate", title: "VAT certificate" },
  { kind: "beneficial_owner_id", title: "Beneficial owner ID" },
];

const RECEIVED: OrganisationDocumentRecord[] = [
  { id: "d1", kind: "vat_certificate", label: null, reviewStatus: "pending" },
  { id: "d2", kind: "beneficial_owner_id", label: null, reviewStatus: "rejected" },
];

const view = (
  role: LegalEntityMemberRole,
  status: LegalEntityStatus = "docs_requested",
  options: { isImpersonation?: boolean; received?: OrganisationDocumentRecord[] } = {},
) =>
  buildOrganisationDocumentsView({
    actor: { role, isImpersonation: options.isImpersonation ?? false },
    status,
    organisationName: "Northbank Gallery",
    slots: SLOTS,
    received: options.received ?? RECEIVED,
  });

describe("buildOrganisationDocumentsView", () => {
  it("lists what was asked for, what was received and each state", () => {
    const rows = view("owner").rows;
    expect(rows.map((row) => [row.title, row.badge.label])).toEqual([
      ["Companies House extract", "Not sent yet"],
      ["VAT certificate", "Received"],
      ["Beneficial owner ID", "Needs replacing"],
    ]);
  });

  it.each(legalEntityMemberRoles)("%s: upload and replace only for owners and admins", (role) => {
    const actions = view(role).rows.map((row) => row.action?.label ?? null);
    const sends = role === "owner" || role === "admin";
    expect(actions).toEqual(sends ? ["Upload", "Replace", "Replace"] : [null, null, null]);
  });

  it("reads only, while the organisation is with us for its checks", () => {
    const owner = view("owner", "under_review");
    expect(owner.rows.map((row) => row.action)).toEqual([null, null, null]);
    expect(owner.rows.map((row) => row.badge.label)).toEqual([
      "Not sent yet",
      "Being checked",
      "Needs replacing",
    ]);
    expect(owner.closedNote).toBe("You can send documents here again if we ask for more.");
    expect(owner.rows[2]?.hint).toMatch(/Our team will be in touch/);
  });

  it("support staff viewing as the organisation read without actions or a note", () => {
    const staff = view("owner", "docs_requested", { isImpersonation: true });
    expect(staff.rows.every((row) => row.action === null)).toBe(true);
    expect(staff.closedNote).toBeNull();
  });

  it("asks owners to send a new copy of a document we could not accept", () => {
    expect(view("owner").rows[2]?.hint).toBe(
      "We couldn't accept this copy. Send a clear, current one.",
    );
    expect(view("owner").rows[0]?.hint).toBeNull();
  });

  it("names other documents when sending them", () => {
    const rows = buildOrganisationDocumentsView({
      actor: { role: "owner" },
      status: "docs_requested",
      organisationName: "Northbank Gallery",
      slots: [{ kind: "other", label: "Probate document", title: "Probate document" }],
      received: [],
    }).rows;
    expect(rows[0]?.action?.target).toEqual({ kind: "other", label: "Probate document" });
  });

  it("never shows a raw review status", () => {
    const rows = view("owner", "docs_requested", {
      received: [{ id: "x", kind: "vat_certificate", label: null, reviewStatus: "weird_value" }],
    }).rows;
    expect(rows[1]?.badge.label).toBe("Received");
  });

  it("shows an approved organisation's requested documents as accepted, with the check date", () => {
    const approved = buildOrganisationDocumentsView({
      actor: { role: "owner" },
      status: "approved",
      organisationName: "Northbank Gallery",
      slots: [{ title: "VAT certificate", kind: "vat_certificate" }],
      received: [],
      checkedOn: new Date("2026-05-09T10:00:00Z"),
    });
    const [row] = approved.rows;
    expect(row?.badge.label).toBe("Accepted");
    expect(row?.hint).toBe("Checked on 9 May 2026");
    expect(row?.action).toBeNull();
  });

  it("says Accepted alone when the check date is unknown", () => {
    const approved = buildOrganisationDocumentsView({
      actor: { role: "owner" },
      status: "approved",
      organisationName: "Northbank Gallery",
      slots: [{ title: "VAT certificate", kind: "vat_certificate" }],
      received: [],
      checkedOn: "not a date",
    });
    expect(approved.rows[0]?.badge.label).toBe("Accepted");
    expect(approved.rows[0]?.hint).toBeNull();
  });

  it("says so when nothing was asked for", () => {
    const empty = buildOrganisationDocumentsView({
      actor: { role: "owner" },
      status: "approved",
      organisationName: "Northbank Gallery",
      slots: [],
      received: [],
    });
    expect(empty.rows).toEqual([]);
    expect(empty.empty).toEqual({
      title: "No documents needed",
      description: "We haven't asked Northbank Gallery for any documents.",
    });
    expect(empty.closedNote).toBeNull();
  });
});
