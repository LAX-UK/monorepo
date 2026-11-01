import { describe, expect, it } from "vitest";
import {
  type ConsignmentThreadMarkers,
  type MarkerMessage,
  markersAfterMessage,
  markersFromMessages,
} from "./consignment-thread-markers.js";

const at = (minute: number) => new Date(Date.UTC(2026, 10, 2, 10, minute));
const client = (minute: number): MarkerMessage => ({
  side: "client",
  visibility: "thread",
  at: at(minute),
});
const staff = (minute: number): MarkerMessage => ({
  side: "staff",
  visibility: "thread",
  at: at(minute),
});
const note = (minute: number): MarkerMessage => ({
  side: "staff",
  visibility: "internal",
  at: at(minute),
});

describe("markersAfterMessage", () => {
  it("starts the wait with the first client message and keeps it through the next", () => {
    const first = markersAfterMessage(null, client(0));
    expect(first.markers.awaitingSince).toEqual(at(0));
    const second = markersAfterMessage(first.markers, client(5));
    expect(second.markers.awaitingSince).toEqual(at(0));
    expect(second.markers.lastMessageAt).toEqual(at(5));
  });

  it("ends the wait with a staff reply", () => {
    const waiting = markersAfterMessage(null, client(0)).markers;
    const answered = markersAfterMessage(waiting, staff(3)).markers;
    expect(answered.awaitingSince).toBeNull();
    expect(answered.lastMessageSide).toBe("staff");
  });

  it("starts a new wait after an answer", () => {
    const answered = markersAfterMessage(null, staff(0)).markers;
    expect(markersAfterMessage(answered, client(9)).markers.awaitingSince).toEqual(at(9));
  });

  it("reopens a closed thread on a client message or a staff reply, not on a note", () => {
    const closed: ConsignmentThreadMarkers = {
      lastMessageAt: at(0),
      lastMessageSide: "staff",
      awaitingSince: null,
      closedAt: at(1),
    };
    expect(markersAfterMessage(closed, client(2))).toMatchObject({
      reopened: true,
      markers: { closedAt: null, awaitingSince: at(2) },
    });
    expect(markersAfterMessage(closed, staff(2))).toMatchObject({
      reopened: true,
      markers: { closedAt: null, awaitingSince: null, lastMessageSide: "staff" },
    });
    expect(markersAfterMessage(closed, note(2))).toEqual({ markers: closed, reopened: false });
  });

  it("leaves every marker as it was for a note", () => {
    const waiting = markersAfterMessage(null, client(0)).markers;
    expect(markersAfterMessage(waiting, note(4))).toEqual({ markers: waiting, reopened: false });
  });

  it("opens a thread that only has a note as answered", () => {
    const { markers } = markersAfterMessage(null, note(0));
    expect(markers).toMatchObject({ lastMessageSide: "staff", awaitingSince: null });
  });
});

describe("markersFromMessages", () => {
  it("is null when no message the client can see is left", () => {
    expect(markersFromMessages([note(0)], null)).toBeNull();
    expect(markersFromMessages([], null)).toBeNull();
  });

  it("waits since the first client message after the last staff reply", () => {
    const markers = markersFromMessages([client(0), staff(1), client(2), note(3), client(4)], null);
    expect(markers).toMatchObject({
      lastMessageSide: "client",
      lastMessageAt: at(4),
      awaitingSince: at(2),
    });
  });

  it("returns to the earlier question when the reply is taken back", () => {
    expect(markersFromMessages([client(0), client(1)], null)?.awaitingSince).toEqual(at(0));
  });

  it("does not wait when the newest message is a reply, and ignores notes", () => {
    const markers = markersFromMessages([client(0), staff(1), note(2)], at(9));
    expect(markers).toEqual({
      lastMessageAt: at(1),
      lastMessageSide: "staff",
      awaitingSince: null,
      closedAt: at(9),
    });
  });
});
