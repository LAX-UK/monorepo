import type { LegalEntityMemberRole } from "@auction/types";
import { describe, expect, it } from "vitest";
import { EnquirerAccountResolver } from "./enquirer-account.resolver.js";

const ENTITY = "6f1c2f60-6a0a-4a53-9a2a-1c9f8f0e9a11";

function resolver(role: LegalEntityMemberRole | null) {
  return new EnquirerAccountResolver({
    memberships: {
      async findActiveMembership(userId, legalEntityId) {
        return role && userId === "user-1" && legalEntityId === ENTITY
          ? { legalEntityId, userId, role, isPrimaryAdmin: false }
          : null;
      },
    },
  });
}

describe("EnquirerAccountResolver", () => {
  it("sends a visitor's enquiry as a guest", async () => {
    expect(
      await resolver(null).resolve({
        viewer: null,
        intent: "private_sale_buy",
        legalEntityId: ENTITY,
      }),
    ).toEqual({ ok: true, account: undefined });
  });

  it("links a signed-in client's enquiry to their account", async () => {
    expect(
      await resolver(null).resolve({
        viewer: { userId: "user-1", role: "client" },
        intent: "private_sale_buy",
      }),
    ).toEqual({ ok: true, account: { userId: "user-1" } });
  });

  it("links an organisation's enquiry when the member may buy for it", async () => {
    expect(
      await resolver("buyer_agent").resolve({
        viewer: { userId: "user-1", role: "client" },
        intent: "private_sale_buy",
        legalEntityId: ENTITY,
      }),
    ).toEqual({ ok: true, account: { userId: "user-1", legalEntityId: ENTITY } });
  });

  it.each(["viewer", "consignor"] as const)(
    "refuses a %s who tries to buy for an organisation",
    async (role) => {
      expect(
        await resolver(role).resolve({
          viewer: { userId: "user-1", role: "client" },
          intent: "private_sale_buy",
          legalEntityId: ENTITY,
        }),
      ).toMatchObject({ ok: false, status: 403, code: "organisation_not_permitted" });
    },
  );

  it("refuses an organisation the person does not belong to", async () => {
    expect(
      await resolver(null).resolve({
        viewer: { userId: "user-1", role: "client" },
        intent: "private_sale_buy",
        legalEntityId: ENTITY,
      }),
    ).toMatchObject({ ok: false, status: 403, code: "organisation_not_permitted" });
  });

  it("ignores an organisation named by a visitor who is not signed in", async () => {
    expect(
      await resolver("owner").resolve({
        viewer: null,
        intent: "private_sale_buy",
        legalEntityId: ENTITY,
      }),
    ).toEqual({ ok: true, account: undefined });
  });

  it("never lets staff send a private sale enquiry", async () => {
    expect(
      await resolver("owner").resolve({
        viewer: { userId: "user-1", role: "staff" },
        intent: "private_sale_sell",
      }),
    ).toMatchObject({ ok: false, status: 403, code: "staff_cannot_enquire" });
  });

  it("lets staff use the general contact form", async () => {
    expect(
      await resolver(null).resolve({
        viewer: { userId: "user-1", role: "staff" },
        intent: "general",
      }),
    ).toEqual({ ok: true, account: { userId: "user-1" } });
  });
});
