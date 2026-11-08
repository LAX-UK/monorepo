import { describe, expect, it } from "vitest";
import { type StillToSendGroup, stillToSendByLot } from "./still-to-send.js";

const group = (over: Partial<StillToSendGroup> = {}): StillToSendGroup => ({
  id: "g1",
  status: "processing",
  rail: "gb_bank_transfer",
  totalPence: 1_170_100,
  receivedPence: 600_000,
  members: [
    { lotId: "lot-a", status: "authorized", amountPence: 800_000 },
    { lotId: "lot-b", status: "authorized", amountPence: 370_100 },
  ],
  ...over,
});

const sum = (shares: Map<string, { pence: number }>) =>
  [...shares.values()].reduce((total, share) => total + share.pence, 0);

describe("stillToSendByLot", () => {
  it("shares what is left of a part-funded transfer across its invoices, adding up exactly", () => {
    const shares = stillToSendByLot([group()]);
    expect(sum(shares)).toBe(570_100);
    expect(shares.get("lot-a")).toEqual({ groupId: "g1", pence: 389_779 });
    expect(shares.get("lot-b")).toEqual({ groupId: "g1", pence: 180_321 });
  });

  it("gives leftover pence to the largest fractions, whatever order the invoices arrive in", () => {
    const members = [
      { lotId: "b", status: "authorized", amountPence: 100 },
      { lotId: "a", status: "authorized", amountPence: 100 },
      { lotId: "c", status: "authorized", amountPence: 100 },
    ];
    const forward = stillToSendByLot([group({ totalPence: 300, receivedPence: 200, members })]);
    const reversed = stillToSendByLot([
      group({ totalPence: 300, receivedPence: 200, members: [...members].reverse() }),
    ]);
    expect(sum(forward)).toBe(100);
    expect([...forward.entries()]).toEqual([...reversed.entries()].sort());
    expect(forward.get("a")?.pence).toBe(34);
  });

  it("leaves nothing for a fully funded transfer", () => {
    expect(stillToSendByLot([group({ receivedPence: 1_170_100 })]).size).toBe(0);
  });

  it("leaves nothing for an overpaid transfer, which is clamped to the total", () => {
    expect(stillToSendByLot([group({ receivedPence: 2_000_000 })]).size).toBe(0);
  });

  it("leaves nothing for a transfer that has delivered nothing, a card, or a group not under way", () => {
    expect(stillToSendByLot([group({ receivedPence: 0 })]).size).toBe(0);
    expect(stillToSendByLot([group({ rail: "card" })]).size).toBe(0);
    for (const status of ["open", "paid", "cancelled"]) {
      expect(stillToSendByLot([group({ status })]).size).toBe(0);
    }
  });

  it("only carries invoices that are on their way, not ones already paid or released", () => {
    const shares = stillToSendByLot([
      group({
        members: [
          { lotId: "lot-a", status: "authorized", amountPence: 800_000 },
          { lotId: "lot-b", status: "cancelled", amountPence: 370_100 },
        ],
      }),
    ]);
    expect([...shares.keys()]).toEqual(["lot-a"]);
    expect(sum(shares)).toBe(570_100);
  });

  it("keeps each group's figures apart and handles amounts beyond safe integer products", () => {
    const shares = stillToSendByLot([
      group({
        id: "g1",
        totalPence: 9_000_000_000,
        receivedPence: 1,
        members: [{ lotId: "x", status: "authorized", amountPence: 9_000_000_000 }],
      }),
      group({ id: "g2", members: [{ lotId: "y", status: "authorized", amountPence: 1_170_100 }] }),
    ]);
    expect(shares.get("x")).toEqual({ groupId: "g1", pence: 8_999_999_999 });
    expect(shares.get("y")).toEqual({ groupId: "g2", pence: 570_100 });
  });
});
