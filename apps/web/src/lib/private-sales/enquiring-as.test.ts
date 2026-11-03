import { describe, expect, it } from "vitest";
import { type EnquirerOrganisation, enquiringAsChoices, resolveChoice } from "./enquiring-as";

const marlow: EnquirerOrganisation = {
  id: "e1",
  name: "Marlow Collection Ltd",
  role: "buyer_agent",
  canBuy: true,
  canSell: false,
};
const hale: EnquirerOrganisation = {
  id: "e2",
  name: "Hale Advisory",
  role: "consignor",
  canBuy: false,
  canSell: true,
};

describe("enquiringAsChoices", () => {
  it("offers only the person alone when they belong to no organisation", () => {
    expect(enquiringAsChoices("buy", [])).toEqual([
      { id: "self", label: "Myself", legalEntityId: undefined },
    ]);
  });

  it("offers the organisations that may enquire to buy on the buy path", () => {
    expect(enquiringAsChoices("buy", [marlow, hale]).map((c) => c.label)).toEqual([
      "Myself",
      "Marlow Collection Ltd",
    ]);
  });

  it("offers the organisations that may enquire to sell on the sell path", () => {
    expect(enquiringAsChoices("sell", [marlow, hale]).map((c) => c.label)).toEqual([
      "Myself",
      "Hale Advisory",
    ]);
  });
});

describe("resolveChoice", () => {
  it("keeps a choice that is still offered", () => {
    expect(resolveChoice("buy", [marlow], "e1").id).toBe("e1");
  });

  it("falls back to the person alone when the organisation is not offered on this path", () => {
    expect(resolveChoice("sell", [marlow], "e1")).toEqual({
      id: "self",
      label: "Myself",
      legalEntityId: undefined,
    });
    expect(resolveChoice("buy", [marlow], undefined).id).toBe("self");
  });
});
