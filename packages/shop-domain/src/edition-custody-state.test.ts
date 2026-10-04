import { describe, expect, it } from "vitest";
import { type EditionCustodyStatus, canTransitionCustodyStatus } from "./edition-custody-state.js";

const ALL: EditionCustodyStatus[] = [
  "unprinted",
  "in_production",
  "qc_failed",
  "stored",
  "in_transit",
  "delivered",
  "collected",
  "with_owner",
  "returned",
];

const ALLOWED: Record<EditionCustodyStatus, readonly EditionCustodyStatus[]> = {
  unprinted: ["unprinted", "in_production", "with_owner"],
  in_production: ["in_production", "qc_failed", "stored", "in_transit"],
  qc_failed: ["qc_failed", "in_production"],
  stored: ["stored", "in_transit", "with_owner"],
  in_transit: ["in_transit", "delivered", "collected"],
  delivered: ["delivered", "returned"],
  collected: ["collected", "returned"],
  with_owner: ["with_owner", "returned"],
  returned: ["returned", "unprinted"],
};

describe("edition custody transitions", () => {
  it.each(ALL.flatMap((from) => ALL.map((to) => [from, to] as const)))("%s -> %s", (from, to) => {
    expect(canTransitionCustodyStatus(from, to)).toBe(ALLOWED[from].includes(to));
  });
});
