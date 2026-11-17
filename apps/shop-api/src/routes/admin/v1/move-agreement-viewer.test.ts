import type { AdminMoveAgreement } from "@auction/shop-contracts";
import type { ShopStaffCapability } from "@auction/shop-domain";
import type { FastifyRequest } from "fastify";
import { describe, expect, it } from "vitest";
import { moveAgreementForViewer } from "./move-agreement-viewer.js";

const PARTY_ID = "77777777-7777-4777-8777-777777777777";
const AGREEMENT_ID = "88888888-8888-4888-8888-888888888888";

const view: AdminMoveAgreement = {
  place: "lax_bid",
  state: "in_force",
  outcome: "allowed",
  checkboxFallbackUntil: "2027-01-31",
  consignor: { partyId: PARTY_ID, displayName: "Example Gallery Ltd" },
  agreement: {
    id: AGREEMENT_ID,
    agreementId: AGREEMENT_ID,
    version: 1,
    places: ["lax_bid"],
    startsOn: "2026-03-03",
    endsOn: null,
    retiredOn: null,
  },
  lowestPricePence: 200_000,
  canAddAgreement: false,
};

const REGISTER_MOVE: ShopStaffCapability[] = ["catalogue.write", "artwork_register.review"];

function requestWith(capabilities: ShopStaffCapability[]): FastifyRequest {
  return {
    shopAdminAuth: {
      subject: "staff-subject",
      scopes: ["shop.admin"],
      roles: [],
      capabilities: new Set(capabilities),
      authTime: undefined,
    },
  } as unknown as FastifyRequest;
}

const deps = {
  staffReader: {
    findActiveByIdentitySubject: async () => null,
    brokerCanAccessClientParty: async () => false,
  },
} as never;

describe("moveAgreementForViewer: the lowest price", () => {
  it("keeps it for someone who holds every capability the move needs", async () => {
    const shown = await moveAgreementForViewer(
      requestWith(REGISTER_MOVE),
      deps,
      view,
      REGISTER_MOVE,
    );
    expect(shown).toEqual({ ...view, consignor: null, agreement: null, canAddAgreement: false });
  });

  it("leaves it out for someone who holds only part of what the move needs", async () => {
    const shown = await moveAgreementForViewer(
      requestWith(["catalogue.write", "artwork_register.read"]),
      deps,
      view,
      REGISTER_MOVE,
    );
    expect(shown.lowestPricePence).toBeNull();
  });

  it("leaves it out for someone who can only check the work", async () => {
    const shown = await moveAgreementForViewer(
      requestWith(["catalogue.read", "artwork_register.read"]),
      deps,
      view,
      REGISTER_MOVE,
    );
    expect(shown.lowestPricePence).toBeNull();
    expect(shown.consignor).toBeNull();
  });

  it("keeps it, with the terms, for someone who reads the client's agreements", async () => {
    const shown = await moveAgreementForViewer(
      requestWith(["artwork_register.read", "client.read_all", "consignor_agreement.read"]),
      deps,
      view,
      REGISTER_MOVE,
    );
    expect(shown).toEqual(view);
  });
});
