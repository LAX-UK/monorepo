import { describe, expect, it } from "vitest";
import { changesRequestedCopy } from "./consignment-changes-copy";

describe("changesRequestedCopy", () => {
  it("tells a member who can edit what to do", () => {
    expect(changesRequestedCopy({ canEdit: true, sentBy: "Lena Fischer" }).lead).toBe(
      "Make the changes, then send it back. It keeps its place and its history.",
    );
  });

  it("tells a read-only member who is making the changes", () => {
    expect(changesRequestedCopy({ canEdit: false, sentBy: "Lena Fischer" }).lead).toBe(
      "Lena Fischer is making the changes the specialist asked for.",
    );
  });

  it("does not invent a name when the sender is unknown", () => {
    expect(changesRequestedCopy({ canEdit: false, sentBy: null }).lead).toBe(
      "A colleague is making the changes the specialist asked for.",
    );
  });

  it("uses no em dashes", () => {
    for (const canEdit of [true, false]) {
      expect(changesRequestedCopy({ canEdit, sentBy: null }).lead).not.toContain("—");
    }
  });
});
