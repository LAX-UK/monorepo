import type { LegalEntity, LegalEntitySummary } from "@auction/types";
import { describe, expect, it } from "vitest";
import { RememberedAccountService } from "./remembered-account.service.js";

const PERSONAL = "00000000-0000-4000-8000-000000000001";
const GALLERY = "00000000-0000-4000-8000-000000000002";

function summary(id: string, kind: LegalEntitySummary["kind"]): LegalEntitySummary {
  return {
    id,
    displayName: kind === "organisation" ? "Northbank Gallery" : "Jane Smith",
    kind,
    subkind: kind === "organisation" ? "gallery" : "private_collector",
    status: "approved",
    role: kind === "organisation" ? "admin" : "owner",
    isPrimaryAdmin: false,
  };
}

function harness(options: {
  memberships: LegalEntitySummary[];
  remembered?: string | null;
  organisationsEnabled?: boolean;
}) {
  const store = { value: options.remembered ?? null, writes: [] as string[] };
  const service = new RememberedAccountService({
    accounts: {
      listActiveMembershipsForUser: async () => options.memberships,
      findById: async (id) =>
        id === GALLERY
          ? ({ id, displayName: "Northbank Gallery", kind: "organisation" } as LegalEntity)
          : null,
    },
    store: {
      findRemembered: async () => store.value,
      remember: async (_userId, legalEntityId) => {
        store.value = legalEntityId;
        store.writes.push(legalEntityId);
      },
    },
    organisationsEnabled: () => options.organisationsEnabled ?? true,
  });
  return { service, store };
}

const member = [summary(PERSONAL, "individual"), summary(GALLERY, "organisation")];

describe("RememberedAccountService.remember", () => {
  it("saves an account the person belongs to", async () => {
    const { service, store } = harness({ memberships: member });
    await expect(service.remember("u1", GALLERY)).resolves.toEqual({ ok: true });
    expect(store.value).toBe(GALLERY);
  });

  it("refuses an organisation the person is not a member of", async () => {
    const { service, store } = harness({ memberships: [summary(PERSONAL, "individual")] });
    await expect(service.remember("u1", GALLERY)).resolves.toEqual({
      ok: false,
      reason: "not_a_member",
    });
    expect(store.writes).toEqual([]);
  });

  it("refuses organisations while they are switched off", async () => {
    const { service } = harness({ memberships: member, organisationsEnabled: false });
    await expect(service.remember("u1", GALLERY)).resolves.toMatchObject({ ok: false });
  });
});

describe("RememberedAccountService.restore", () => {
  it("opens the remembered organisation on a new device", async () => {
    const { service, store } = harness({ memberships: member, remembered: GALLERY });
    await expect(service.restore("u1", null)).resolves.toEqual({
      accountId: GALLERY,
      lostOrganisation: null,
    });
    expect(store.writes).toEqual([]);
  });

  it("prefers the account this browser used, and remembers it", async () => {
    const { service, store } = harness({ memberships: member, remembered: PERSONAL });
    await expect(service.restore("u1", GALLERY)).resolves.toMatchObject({ accountId: GALLERY });
    expect(store.value).toBe(GALLERY);
  });

  it("opens personal when nothing is remembered", async () => {
    const { service } = harness({ memberships: member });
    await expect(service.restore("u1", null)).resolves.toEqual({
      accountId: PERSONAL,
      lostOrganisation: null,
    });
  });

  it("falls back to personal after removal, names the organisation once, and corrects the profile", async () => {
    const { service, store } = harness({
      memberships: [summary(PERSONAL, "individual")],
      remembered: GALLERY,
    });
    await expect(service.restore("u1", null)).resolves.toEqual({
      accountId: PERSONAL,
      lostOrganisation: { id: GALLERY, displayName: "Northbank Gallery" },
    });
    expect(store.value).toBe(PERSONAL);
    await expect(service.restore("u1", null)).resolves.toEqual({
      accountId: PERSONAL,
      lostOrganisation: null,
    });
  });

  it("drops an unknown id without a notice", async () => {
    const { service } = harness({ memberships: member });
    await expect(service.restore("u1", "00000000-0000-4000-8000-0000000000ff")).resolves.toEqual({
      accountId: PERSONAL,
      lostOrganisation: null,
    });
  });

  it("returns nothing for a person without a personal account", async () => {
    const { service } = harness({ memberships: [] });
    await expect(service.restore("u1", null)).resolves.toBeNull();
  });
});
