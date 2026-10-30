import type { LegalEntitySummary } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  REGISTER_ORGANISATION_HREF,
  buildAccountChrome,
  pendingInvitationsLabel,
} from "./account-switcher-model";

const personal: LegalEntitySummary = {
  id: "me",
  displayName: "Jane Smith",
  kind: "individual",
  subkind: "private_collector",
  status: "approved",
  role: "owner",
  isPrimaryAdmin: true,
};

const gallery: LegalEntitySummary = {
  id: "northbank",
  displayName: "Northbank Gallery",
  kind: "organisation",
  subkind: "gallery",
  status: "approved",
  role: "admin",
  isPrimaryAdmin: false,
};

const estate: LegalEntitySummary = {
  ...gallery,
  id: "holloway",
  displayName: "Holloway Estate",
  role: "consignor",
};

function chrome(overrides: Partial<Parameters<typeof buildAccountChrome>[0]> = {}) {
  return buildAccountChrome({
    personName: "Jane Smith",
    memberships: [personal, gallery, estate],
    actingId: null,
    orgModuleEnabled: true,
    pendingInvitations: 0,
    ...overrides,
  });
}

describe("buildAccountChrome", () => {
  it("marks an organisation whose documents are under review", () => {
    const reviewing = { ...estate, status: "under_review" as const };
    const result = chrome({ memberships: [personal, gallery, reviewing] });
    const option = result.switcher?.options.find((o) => o.id === "holloway");
    expect(option).toMatchObject({ detail: "Consignor · Under review", underReview: true });
    expect(result.switcher?.options.find((o) => o.id === "northbank")?.underReview).toBe(false);
  });

  it("hides the switcher for someone with no organisation", () => {
    const result = chrome({ memberships: [personal] });
    expect(result.switcher).toBeNull();
    expect(result.current).toMatchObject({ name: "Personal", detail: "Jane Smith" });
  });

  it("hides organisations everywhere while they are switched off", () => {
    const result = chrome({ actingId: "northbank", orgModuleEnabled: false });
    expect(result.switcher).toBeNull();
  });

  it("lists Personal first, then each organisation with the person's role", () => {
    const options = chrome().switcher?.options ?? [];
    expect(options.map((o) => [o.name, o.detail, o.initials])).toEqual([
      ["Personal", "Jane Smith", "JS"],
      ["Northbank Gallery", "Admin", "NG"],
      ["Holloway Estate", "Consignor", "HE"],
    ]);
  });

  it("ticks the account in use and names it with the role", () => {
    const result = chrome({ actingId: "northbank" });
    expect(result.current).toMatchObject({ name: "Northbank Gallery", detail: "Admin" });
    expect(result.switcher?.options.filter((o) => o.current).map((o) => o.id)).toEqual([
      "northbank",
    ]);
  });

  it("falls back to Personal for an account the person no longer has", () => {
    expect(chrome({ actingId: "elsewhere" }).current.kind).toBe("personal");
  });

  it("carries the footer: pending invitations and registering an organisation", () => {
    const switcher = chrome({ pendingInvitations: 2 }).switcher;
    expect(switcher).toMatchObject({
      pendingInvitations: 2,
      invitationsHref: "/organisations/invitations",
      registerHref: REGISTER_ORGANISATION_HREF,
    });
  });
});

describe("pendingInvitationsLabel", () => {
  it("counts invitations and caps the number", () => {
    expect(pendingInvitationsLabel(2)).toBe("Pending invitations (2)");
    expect(pendingInvitationsLabel(14)).toBe("Pending invitations (9+)");
  });
});
