import { describe, expect, it } from "vitest";
import { lastEditorName, otherEditorName } from "./data-request-editor";

const entry = (event: string, actorName: string | null) => ({
  at: "2026-11-02T10:00:00.000Z",
  event,
  actorName,
  device: null,
  detail: {},
});

describe("lastEditorName", () => {
  it("names the person behind the newest entry", () => {
    expect(
      lastEditorName([
        entry("data_request.logged", "Sofia Okafor"),
        entry("data_request.notes_edited", "Daniel Price"),
      ]),
    ).toBe("Daniel Price");
  });

  it("passes over entries nobody is named for", () => {
    expect(
      lastEditorName([
        entry("data_request.logged", "Sofia Okafor"),
        entry("data_export.deadline_alert", null),
        entry("data_request.extended", "  "),
      ]),
    ).toBe("Sofia Okafor");
  });

  it("skips one unnamed entry at a time to reach the newest name", () => {
    expect(
      lastEditorName([
        entry("data_request.logged", "Sofia Okafor"),
        entry("data_request.notes_edited", "Daniel Price"),
        entry("data_export.deadline_alert", null),
      ]),
    ).toBe("Daniel Price");
  });

  it("is null when nobody is named", () => {
    expect(lastEditorName([entry("data_export.requested", null)])).toBeNull();
    expect(lastEditorName([])).toBeNull();
  });
});

describe("otherEditorName", () => {
  const timeline = [entry("data_request.notes_edited", "Sofia Okafor")];
  it("names the last editor when it is someone else", () => {
    expect(otherEditorName(timeline, "Daniel Price")).toBe("Sofia Okafor");
  });
  it("names no one when the last editor is the reader, however the name is cased", () => {
    expect(otherEditorName(timeline, " sofia okafor ")).toBeNull();
  });
  it("still names the editor when the reader's own name is not known", () => {
    expect(otherEditorName(timeline, undefined)).toBe("Sofia Okafor");
  });
});
