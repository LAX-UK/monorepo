import { describe, expect, it } from "vitest";
import { resolveClerkActionPolicy } from "./clerk-action-policy";

describe("resolveClerkActionPolicy", () => {
  const nextLot = { id: "lot-2" } as import("@auction/types").Lot;

  it("returns all false when session is not active", () => {
    expect(
      resolveClerkActionPolicy({
        phase: "setup",
        sessionStatus: "none",
        canHammer: false,
        nextLot,
        betweenLots: false,
      }),
    ).toEqual({
      advanceInRunway: false,
      advanceInDock: false,
      hammerInDock: false,
      jumpToLotInRunway: false,
    });
  });

  it("routes advance and hammer to dock only while selling", () => {
    expect(
      resolveClerkActionPolicy({
        phase: "selling",
        sessionStatus: "live",
        canHammer: true,
        nextLot,
        betweenLots: false,
      }),
    ).toMatchObject({
      advanceInRunway: false,
      advanceInDock: true,
      hammerInDock: true,
      jumpToLotInRunway: true,
    });
  });

  it("routes between-lots advance to dock only", () => {
    expect(
      resolveClerkActionPolicy({
        phase: "betweenLots",
        sessionStatus: "live",
        canHammer: false,
        nextLot,
        betweenLots: true,
      }),
    ).toMatchObject({
      advanceInRunway: false,
      advanceInDock: true,
      jumpToLotInRunway: true,
    });
  });

  it("shows dock advance while paused with next lot", () => {
    expect(
      resolveClerkActionPolicy({
        phase: "paused",
        sessionStatus: "paused",
        canHammer: false,
        nextLot,
        betweenLots: false,
      }),
    ).toMatchObject({
      advanceInDock: true,
      jumpToLotInRunway: true,
    });
  });

  it("disables all lot actions when concluded", () => {
    expect(
      resolveClerkActionPolicy({
        phase: "concluded",
        sessionStatus: "live",
        canHammer: true,
        nextLot: null,
        betweenLots: true,
      }),
    ).toEqual({
      advanceInRunway: false,
      advanceInDock: false,
      hammerInDock: false,
      jumpToLotInRunway: false,
    });
  });
});
