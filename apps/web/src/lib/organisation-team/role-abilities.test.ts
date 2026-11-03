import { describe, expect, it } from "vitest";
import { roleAbilities } from "./role-abilities";

const answers = (role: Parameters<typeof roleAbilities>[0]) =>
  Object.fromEntries(roleAbilities(role).map((a) => [a.id, a.answer]));

describe("roleAbilities", () => {
  it("lets owners and admins do all three", () => {
    expect(answers("owner")).toEqual({ bid: "Yes", pay: "Yes", sell: "Yes" });
    expect(answers("admin")).toEqual({ bid: "Yes", pay: "Yes", sell: "Yes" });
  });
  it("lets a buyer agent bid only once authorised", () => {
    expect(answers("buyer_agent")).toEqual({ bid: "Once authorised", pay: "No", sell: "No" });
  });
  it("gives finance the money and consignors the selling", () => {
    expect(answers("finance")).toEqual({ bid: "No", pay: "Yes", sell: "No" });
    expect(answers("consignor")).toEqual({ bid: "No", pay: "No", sell: "Yes" });
  });
  it("lets a viewer change nothing", () => {
    expect(answers("viewer")).toEqual({ bid: "No", pay: "No", sell: "No" });
  });
});
