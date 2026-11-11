import { describe, expect, it, vi } from "vitest";
import {
  MAX_LINEAGE_PER_SESSION,
  type NewSession,
  type SessionSnapshot,
  SessionTakeoverService,
  type SessionTakeoverStore,
  planTakeover,
} from "./session-takeover.service.js";

const NOW = new Date("2026-11-11T12:00:00.000Z");
const fresh: NewSession = { id: "new", userId: "ann", createdAt: NOW };
const snapshot = (over: Partial<SessionSnapshot> & { id: string }): SessionSnapshot => ({
  userId: "ann",
  signedInAt: new Date("2026-11-01T09:00:00.000Z"),
  previousSids: [],
  ...over,
});

describe("planTakeover", () => {
  it("replaces the same person's records and keeps the original sign-in time", () => {
    const plan = planTakeover(fresh, [
      snapshot({ id: "a", signedInAt: new Date("2026-11-05T00:00:00.000Z") }),
      snapshot({ id: "b", signedInAt: new Date("2026-11-02T00:00:00.000Z") }),
    ]);
    expect(plan.sameSubject.map((s) => s.id)).toEqual(["a", "b"]);
    expect(plan.otherSubject).toEqual([]);
    expect(plan.signedInAt).toEqual(new Date("2026-11-02T00:00:00.000Z"));
  });

  it("ends another person's records and does not borrow their sign-in time", () => {
    const plan = planTakeover(fresh, [snapshot({ id: "x", userId: "ben" })]);
    expect(plan.sameSubject).toEqual([]);
    expect(plan.otherSubject.map((s) => s.id)).toEqual(["x"]);
    expect(plan.signedInAt).toEqual(NOW);
  });

  it("starts at the new record's own time when the browser had nothing", () => {
    expect(planTakeover(fresh, []).signedInAt).toEqual(NOW);
  });
});

function setup(prior: SessionSnapshot[], newSession: NewSession | null = fresh) {
  const store: SessionTakeoverStore = {
    findSession: vi.fn(async () => newSession),
    findLive: vi.fn(async () => prior),
    replace: vi.fn(async () => undefined),
  };
  const ended = { ended: vi.fn(async () => undefined) };
  const service = new SessionTakeoverService(store, ended, () => NOW);
  return { store, ended, service };
}

const input = {
  newSessionId: "new",
  previousSessionId: "a",
  deviceHash: "hash",
  country: "GB",
};

describe("SessionTakeoverService", () => {
  it("asks for records of this browser by cookie and by device, never the new one", async () => {
    const { store, service } = setup([]);
    await service.takeOver(input);
    expect(store.findLive).toHaveBeenCalledWith({
      previousSessionId: "a",
      deviceHash: "hash",
      excludeId: "new",
      now: NOW,
    });
  });

  it("same person: replaces the old record, remembers it, and signs nobody out", async () => {
    const { store, ended, service } = setup([snapshot({ id: "a" })]);
    await service.takeOver(input);
    expect(store.replace).toHaveBeenCalledWith(
      expect.objectContaining({
        newSessionId: "new",
        userId: "ann",
        deviceHash: "hash",
        country: "GB",
        maxLineage: MAX_LINEAGE_PER_SESSION,
        sameSubject: [expect.objectContaining({ id: "a" })],
        otherSubject: [],
      }),
    );
    expect(ended.ended).not.toHaveBeenCalled();
  });

  it("different person: ends their record and every earlier name of it", async () => {
    const { ended, service } = setup([
      snapshot({ id: "x", userId: "ben", previousSids: ["x0", "x-1"] }),
    ]);
    await service.takeOver(input);
    expect(ended.ended).toHaveBeenCalledWith({
      userId: "ben",
      sessionIds: ["x", "x0", "x-1"],
    });
  });

  it("does nothing when the new record cannot be found", async () => {
    const { store, service } = setup([], null);
    await service.takeOver(input);
    expect(store.replace).not.toHaveBeenCalled();
  });

  it("allows at most 20 earlier names per record", () => {
    expect(MAX_LINEAGE_PER_SESSION).toBe(20);
  });
});
