import { legalEntityMemberRoles, legalEntityStatuses } from "@auction/types";
import type { LegalEntityMemberRole, LegalEntityStatus } from "@auction/types";
import { describe, expect, it } from "vitest";
import { buildOrganisationDocumentsView } from "./organisation-documents.vm";
import {
  buildOrganisationRecoveryView,
  organisationRecoveryForPage,
  recoveryShowsDocuments,
} from "./organisation-recovery.vm";

const SLOTS = [
  { kind: "companies_house_extract", title: "Companies House extract" },
  { kind: "vat_certificate", title: "VAT certificate" },
  { kind: "beneficial_owner_id", title: "Beneficial owner ID" },
];
const RECEIVED = [
  { id: "d1", kind: "vat_certificate", label: null, reviewStatus: "pending" },
  { id: "d2", kind: "beneficial_owner_id", label: null, reviewStatus: "rejected" },
];

function documents(role: LegalEntityMemberRole, status: LegalEntityStatus) {
  return buildOrganisationDocumentsView({
    actor: { role },
    status,
    organisationName: "Northbank Gallery",
    slots: SLOTS,
    received: RECEIVED,
  });
}

function recovery(
  status: LegalEntityStatus,
  options: {
    role?: LegalEntityMemberRole;
    personal?: string | null;
    impersonating?: boolean;
    receivedAt?: Date | null;
    now?: Date;
    canBid?: boolean;
  } = {},
) {
  return buildOrganisationRecoveryView({
    status,
    documents: recoveryShowsDocuments(status) ? documents(options.role ?? "owner", status) : null,
    documentsReceivedAt: options.receivedAt ?? null,
    now: options.now ?? new Date("2026-11-06T12:00:00Z"),
    personalAccountId: options.personal === undefined ? "person-1" : options.personal,
    personalCanBid: options.canBid ?? true,
    impersonating: options.impersonating ?? false,
  });
}

describe("buildOrganisationRecoveryView", () => {
  it.each(["connect_pending", "approved", "archived"] as const)(
    "has no recovery for %s",
    (status) => {
      expect(recovery(status)).toBeNull();
    },
  );

  it.each(legalEntityStatuses)("%s: every row says its state in words", (status) => {
    const view = recovery(status);
    if (!view) return;
    expect(view.heading).toBe("What you can do now");
    expect(view.abilities.map((row) => row.label)).toEqual([
      "Read sales, purchases and invoices",
      "Pay invoices already issued",
      "Bid, register and send works",
    ]);
    for (const row of view.abilities) expect(row.tag.label.length).toBeGreaterThan(0);
  });

  it("tells a restricted organisation what stays open and what is paused", () => {
    const view = recovery("restricted");
    expect(view?.abilities.map((row) => [row.key, row.open, row.tag.label])).toEqual([
      ["history", true, "Available"],
      ["pay", true, "Available"],
      ["trade", false, "Paused"],
    ]);
    expect(view?.documents).toBeNull();
    expect(view?.progress).toBeNull();
  });

  it("says a refused organisation can only read, and waits are not called pauses", () => {
    expect(recovery("rejected")?.abilities.map((row) => row.tag.label)).toEqual([
      "Available",
      "Not available",
      "Not available",
    ]);
    expect(recovery("docs_requested")?.abilities.map((row) => row.tag.label)).toEqual([
      "Available",
      "Opens once checked",
      "Opens once checked",
    ]);
  });

  describe("documents asked for", () => {
    it("owners and admins get a link to the Documents tab for what still needs sending", () => {
      for (const role of ["owner", "admin"] as const) {
        const rows = recovery("docs_requested", { role })?.documents?.rows ?? [];
        expect(rows.map((row) => [row.title, row.badge.label, row.link?.label ?? null])).toEqual([
          ["Companies House extract", "Not sent yet", "Upload"],
          ["VAT certificate", "Received", null],
          ["Beneficial owner ID", "Needs replacing", "Replace"],
        ]);
        expect(rows[2]?.link?.href).toBe("/organisation/documents");
      }
    });

    it.each(legalEntityMemberRoles.filter((r) => r !== "owner" && r !== "admin"))(
      "%s reads the same list without a way to send",
      (role) => {
        const rows = recovery("docs_requested", { role })?.documents?.rows ?? [];
        expect(rows.map((row) => row.badge.label)).toEqual([
          "Not sent yet",
          "Received",
          "Needs replacing",
        ]);
        expect(rows.every((row) => row.link === null)).toBe(true);
        expect(rows[2]?.hint).toMatch(/Our team will be in touch/);
      },
    );

    it("shows the checklist while documents are checked, with no links", () => {
      const view = recovery("under_review");
      expect(view?.documents?.rows.map((row) => row.badge.label)).toEqual([
        "Not sent yet",
        "Being checked",
        "Needs replacing",
      ]);
      expect(view?.documents?.rows.every((row) => row.link === null)).toBe(true);
    });

    it("leaves the checklist out when there is nothing to list", () => {
      const view = buildOrganisationRecoveryView({
        status: "docs_requested",
        documents: { intro: "", rows: [], empty: null, closedNote: null },
        documentsReceivedAt: null,
        now: new Date(),
        personalAccountId: null,
        personalCanBid: false,
        impersonating: false,
      });
      expect(view?.documents).toBeNull();
    });
  });

  describe("how far the check has got", () => {
    const received = new Date("2026-11-04T10:00:00Z");

    it("names the day the latest document arrived, with no way to chase while it is in time", () => {
      for (const status of ["docs_received", "under_review"] as const) {
        const view = recovery(status, { receivedAt: received });
        expect(view?.progress).toEqual({
          line: "Documents received on 4 November 2026.",
          contact: null,
        });
      }
    });

    it("offers Contact us only once three working days have passed", () => {
      const late = recovery("under_review", {
        receivedAt: received,
        now: new Date("2026-11-09T12:00:00Z"),
      });
      expect(late?.progress?.line).toBe(
        "Documents received on 4 November 2026. Waiting longer than 3 working days?",
      );
      expect(late?.progress?.contact?.label).toBe("Contact us");
      const weekend = recovery("under_review", {
        receivedAt: received,
        now: new Date("2026-11-08T12:00:00Z"),
      });
      expect(weekend?.progress?.contact).toBeNull();
    });

    it("says nothing without a document date, and nothing for other states", () => {
      expect(recovery("under_review", { receivedAt: null })?.progress).toBeNull();
      expect(recovery("restricted", { receivedAt: received })?.progress).toBeNull();
      expect(recovery("docs_requested", { receivedAt: received })?.progress).toBeNull();
    });
  });

  describe("keeping on as yourself", () => {
    it("offers a full page load into the personal account", () => {
      const personal = recovery("restricted")?.personal;
      expect(personal?.label).toBe("Keep bidding as yourself");
      expect(personal?.href).toEqual({ hop: "/bids?account=person-1" });
    });

    it("is offered in every recovery state", () => {
      for (const status of ["docs_requested", "under_review", "restricted", "rejected"] as const) {
        expect(recovery(status)?.personal).not.toBeNull();
      }
    });

    it("is hidden until the personal account can bid", () => {
      expect(recovery("restricted", { canBid: false })?.personal).toBeNull();
    });

    it("is hidden without a personal account to switch to", () => {
      expect(recovery("restricted", { personal: null })?.personal).toBeNull();
    });

    it("is hidden from support staff viewing as the client", () => {
      expect(recovery("restricted", { impersonating: true })?.personal).toBeNull();
    });
  });
});

describe("organisationRecoveryForPage", () => {
  it("drops the checklist on the Documents tab, which lists it in full", () => {
    const view = recovery("docs_requested");
    if (!view) throw new Error("expected a recovery");
    expect(organisationRecoveryForPage(view, "/organisation/documents").documents).toBeNull();
    expect(organisationRecoveryForPage(view, "/organisation").documents).not.toBeNull();
    expect(organisationRecoveryForPage(view, "/home").documents).not.toBeNull();
  });
});
