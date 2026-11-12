import type { IPublicLotResultReader } from "@auction/persistence/interfaces";
import type { Lot } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { asResultPending, withPublicLotResults } from "./public-lot-result.js";

const lot = (id: string, overrides: Partial<Lot> = {}): Lot =>
  ({
    id,
    status: "ended",
    winnerId: "buyer-1",
    buyerLegalEntityId: "entity-1",
    currentPrice: "88000.00",
    startingPrice: "20000.00",
    ...overrides,
  }) as Lot;

const reader = (pending: string[]): IPublicLotResultReader => ({
  pendingAmong: vi.fn(
    async (ids: readonly string[]) => new Set(ids.filter((id) => pending.includes(id))),
  ),
});

describe("asResultPending", () => {
  it("removes the buyer and the price, and says the result is open", () => {
    const shown = asResultPending(lot("a"));
    expect(shown).toMatchObject({
      winnerId: null,
      buyerLegalEntityId: null,
      currentPrice: "20000.00",
      resultPending: true,
    });
    expect(JSON.stringify(shown)).not.toContain("88000");
    expect(JSON.stringify(shown)).not.toContain("buyer-1");
  });
});

describe("withPublicLotResults", () => {
  it("presents only the lots whose result is open", async () => {
    const lots = [lot("a"), lot("b")];
    const shown = await withPublicLotResults(reader(["a"]), lots);
    expect(shown[0]).toMatchObject({ id: "a", resultPending: true, winnerId: null });
    expect(shown[1]).toBe(lots[1]);
  });

  it("asks only about ended lots", async () => {
    const source = reader([]);
    await withPublicLotResults(source, [lot("a"), lot("b", { status: "active" })]);
    expect(source.pendingAmong).toHaveBeenCalledWith(["a"]);
  });

  it("does not ask when nothing has ended", async () => {
    const source = reader([]);
    await withPublicLotResults(source, [lot("b", { status: "active" })]);
    expect(source.pendingAmong).not.toHaveBeenCalled();
  });

  it("returns the lots as they are when no reader is wired", async () => {
    const lots = [lot("a")];
    expect(await withPublicLotResults(null, lots)).toEqual(lots);
  });
});
