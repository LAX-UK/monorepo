import { hopHref } from "@/lib/navigation/hop-href";
import { describe, expect, it } from "vitest";
import { type OrganisationSource, accountRows, invitationRows } from "./organisation-accounts.vm";

const personal = { id: "me", displayName: "Oliver Grant", subkind: "private_collector" };

function organisation(partial: Partial<OrganisationSource> & Pick<OrganisationSource, "id">) {
  return {
    displayName: "Northbank Gallery",
    subkind: "gallery",
    status: "approved",
    role: "owner",
    resumeHref: null,
    payoutDetailsNeeded: false,
    ...partial,
  } satisfies OrganisationSource;
}

describe("accountRows", () => {
  it("lists the person's own account first, then organisations by name", () => {
    const rows = accountRows({
      personal,
      organisations: [
        organisation({ id: "b", displayName: "Zeta Estate" }),
        organisation({ id: "a", displayName: "Alder Gallery" }),
      ],
      actingId: null,
    });
    expect(rows.map((row) => row.title)).toEqual(["Personal", "Alder Gallery", "Zeta Estate"]);
    expect(rows[0]?.meta).toEqual(["Oliver Grant", "In use"]);
  });

  it("says what the organisation is and the person's role, and marks the one in use", () => {
    const [, row] = accountRows({
      personal,
      organisations: [organisation({ id: "nb" })],
      actingId: "nb",
    });
    expect(row?.meta).toEqual(["Gallery", "Owner", "In use"]);
    expect(row?.current).toBe(true);
  });

  it("opens each other account in that account, and the one in use as it is", () => {
    const rows = accountRows({
      personal,
      organisations: [organisation({ id: "nb" })],
      actingId: null,
    });
    expect(rows[0]?.href).toBe("/bids");
    expect(rows[1]?.href).toEqual(hopHref("/home?account=nb"));
    const inOrganisation = accountRows({
      personal,
      organisations: [organisation({ id: "nb" })],
      actingId: "nb",
    });
    expect(inOrganisation[0]?.href).toEqual(hopHref("/bids?account=me"));
    expect(inOrganisation[1]?.href).toBe("/home");
  });

  it("shows no badge for an approved organisation", () => {
    const [, row] = accountRows({
      personal,
      organisations: [organisation({ id: "nb" })],
      actingId: null,
    });
    expect(row?.attention).toBeNull();
    expect(row?.step).toBeNull();
  });

  it("shows one badge, in the organisation's own words, while something needs attention", () => {
    const [, row] = accountRows({
      personal,
      organisations: [organisation({ id: "nb", status: "docs_requested" })],
      actingId: null,
    });
    expect(row?.attention).toMatchObject({ label: "Documents requested", tone: "warning" });
    expect(row?.step?.label).toBe("Continue setup");
  });

  it("keeps the review badge but offers only Open while LAX reviews", () => {
    const [, row] = accountRows({
      personal,
      organisations: [organisation({ id: "nb", status: "under_review" })],
      actingId: null,
    });
    expect(row?.attention).toMatchObject({ label: "Documents under review" });
    expect(row?.step).toBeNull();
  });

  it("offers payout setup for an organisation waiting on it, at the resume step", () => {
    const [, row] = accountRows({
      personal,
      organisations: [
        organisation({ id: "nb", status: "connect_pending", resumeHref: "/resume/connect" }),
      ],
      actingId: null,
    });
    expect(row?.step).toEqual({ label: "Finish payout setup", href: "/resume/connect" });
  });

  it("flags an approved organisation that still lacks payout details", () => {
    const [, row] = accountRows({
      personal,
      organisations: [organisation({ id: "nb", payoutDetailsNeeded: true })],
      actingId: null,
    });
    expect(row?.attention).toMatchObject({ label: "Payout details needed", tone: "warning" });
  });

  it("leaves out a personal row when there is none", () => {
    const rows = accountRows({ personal: null, organisations: [], actingId: null });
    expect(rows).toEqual([]);
  });
});

describe("invitationRows", () => {
  it("lists the soonest to expire first, with sender, role and expiry", () => {
    const rows = invitationRows([
      {
        id: "late",
        orgDisplayName: "Late Gallery",
        inviterName: "Pat",
        roleOffered: "admin",
        expiresAt: "2026-12-31T00:00:00.000Z",
      },
      {
        id: "soon",
        orgDisplayName: "Soon Gallery",
        inviterName: "Sam",
        roleOffered: "finance",
        expiresAt: "2026-11-10T00:00:00.000Z",
      },
    ]);
    expect(rows.map((row) => row.id)).toEqual(["soon", "late"]);
    expect(rows[0]).toMatchObject({
      title: "Soon Gallery",
      meta: ["From Sam", "Finance", "Expires 10 Nov 2026"],
      reviewHref: "/organisations/invitations/review/soon",
    });
  });
});
