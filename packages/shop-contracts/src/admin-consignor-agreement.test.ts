import "./contract-formats.js";
import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import {
  AdminArtworkConsignorSchema,
  AdminArtworkConsignorSetBodySchema,
  AdminConsignorAgreementCreateBodySchema,
  AdminConsignorAgreementFileUploadBodySchema,
  AdminConsignorAgreementListSchema,
  AdminConsignorAgreementReplaceBodySchema,
  AdminConsignorAgreementRetireBodySchema,
  CONSIGNOR_AGREEMENT_FILE_MAX_BYTES,
} from "./admin-consignor-agreement.js";

const ID = "11111111-1111-4111-8111-111111111111";
const PARTY = "22222222-2222-4222-8222-222222222222";

const agreement = {
  id: ID,
  agreementId: ID,
  version: 1,
  partyId: PARTY,
  places: ["lax_bid", "lax_art"],
  startsOn: "2026-03-03",
  endsOn: "2027-03-02",
  lowestPricePence: 200_000,
  commissionBasisPoints: 2500,
  signedFileKey: "consignor-agreements/one/signed.pdf",
  note: null,
  status: "current",
  replacesId: null,
  createdAt: "2026-03-03T10:00:00.000Z",
  replacedAt: null,
  retiredAt: null,
};

const terms = {
  places: ["lax_bid"],
  startsOn: "2026-03-03",
  signedFileKey: "consignor-agreements/one/signed.pdf",
};

describe("consignor agreement contract", () => {
  it("accepts a list of agreements", () => {
    expect(
      Value.Check(AdminConsignorAgreementListSchema, {
        party: { partyId: PARTY, displayName: "Ivo Marren" },
        items: [agreement],
      }),
    ).toBe(true);
  });

  it("knows only the three places and the three statuses", () => {
    const check = (patch: object) =>
      Value.Check(AdminConsignorAgreementListSchema, {
        party: { partyId: PARTY, displayName: "Ivo Marren" },
        items: [{ ...agreement, ...patch }],
      });
    expect(check({ places: ["private_sale"] })).toBe(true);
    expect(check({ places: ["zoho"] })).toBe(false);
    expect(check({ places: [] })).toBe(false);
    expect(check({ status: "draft" })).toBe(false);
  });

  it("keeps amounts in whole minor units", () => {
    const create = (patch: object) =>
      Value.Check(AdminConsignorAgreementCreateBodySchema, { ...terms, ...patch });
    expect(create({ lowestPricePence: 200_000, commissionBasisPoints: 2500 })).toBe(true);
    expect(create({ lowestPricePence: 2000.5 })).toBe(false);
    expect(create({ lowestPricePence: 0 })).toBe(false);
    expect(create({ commissionBasisPoints: 12.5 })).toBe(false);
    expect(create({ commissionBasisPoints: 10_001 })).toBe(false);
    expect(create({ lowestPricePence: null, commissionBasisPoints: null, endsOn: null })).toBe(
      true,
    );
  });

  it("takes real calendar days and refuses fields it does not know", () => {
    expect(
      Value.Check(AdminConsignorAgreementCreateBodySchema, { ...terms, startsOn: "2026-02-30" }),
    ).toBe(false);
    expect(Value.Check(AdminConsignorAgreementCreateBodySchema, { ...terms, status: "x" })).toBe(
      false,
    );
  });

  it("replaces and retires from the version staff read", () => {
    expect(
      Value.Check(AdminConsignorAgreementReplaceBodySchema, { expectedVersion: 1, ...terms }),
    ).toBe(true);
    expect(Value.Check(AdminConsignorAgreementReplaceBodySchema, terms)).toBe(false);
    expect(Value.Check(AdminConsignorAgreementRetireBodySchema, { expectedVersion: 2 })).toBe(true);
    expect(Value.Check(AdminConsignorAgreementRetireBodySchema, {})).toBe(false);
  });
});

describe("artwork consignor contract", () => {
  const change = {
    id: ID,
    consignor: { kind: "client", partyId: PARTY, displayName: "A. Collector" },
    changeReason: null,
    setAt: "2026-11-17T10:00:00.000Z",
    setByName: "Sam Staff",
  };

  it("reads a client or LAX, or nothing set yet", () => {
    expect(
      Value.Check(AdminArtworkConsignorSchema, {
        registerId: ID,
        current: change,
        history: [change],
      }),
    ).toBe(true);
    const lax = { ...change, consignor: { kind: "lax" }, changeReason: "Bought outright" };
    expect(
      Value.Check(AdminArtworkConsignorSchema, { registerId: ID, current: lax, history: [lax] }),
    ).toBe(true);
    expect(
      Value.Check(AdminArtworkConsignorSchema, { registerId: ID, current: null, history: [] }),
    ).toBe(true);
  });

  it("sets a client by party, or LAX with no party", () => {
    expect(
      Value.Check(AdminArtworkConsignorSetBodySchema, {
        consignor: { kind: "client", partyId: PARTY },
      }),
    ).toBe(true);
    expect(
      Value.Check(AdminArtworkConsignorSetBodySchema, {
        consignor: { kind: "lax" },
        reason: "Bought outright",
      }),
    ).toBe(true);
    expect(
      Value.Check(AdminArtworkConsignorSetBodySchema, {
        consignor: { kind: "lax", partyId: PARTY },
      }),
    ).toBe(false);
    expect(Value.Check(AdminArtworkConsignorSetBodySchema, { consignor: { kind: "client" } })).toBe(
      false,
    );
  });
});

describe("signed file uploads", () => {
  it("takes a PDF, JPEG or PNG of up to 20 MB", () => {
    const body = (patch: object) =>
      Value.Check(AdminConsignorAgreementFileUploadBodySchema, {
        contentType: "application/pdf",
        byteSize: 1024,
        ...patch,
      });
    expect(body({})).toBe(true);
    expect(body({ contentType: "image/png" })).toBe(true);
    expect(body({ contentType: "image/gif" })).toBe(false);
    expect(body({ byteSize: CONSIGNOR_AGREEMENT_FILE_MAX_BYTES })).toBe(true);
    expect(body({ byteSize: CONSIGNOR_AGREEMENT_FILE_MAX_BYTES + 1 })).toBe(false);
    expect(body({ byteSize: 0 })).toBe(false);
  });
});
