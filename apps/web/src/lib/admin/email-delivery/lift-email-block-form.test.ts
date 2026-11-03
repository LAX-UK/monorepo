import { describe, expect, it } from "vitest";
import { initialLiftDraft, toLiftBody, validateLift } from "./lift-email-block-form";

const bounce = {
  since: "2026-10-28T16:02:00.000Z",
  liftReasons: ["mailbox_fixed", "address_confirmed", "blocked_by_mistake", "other"] as const,
  noteRequired: false,
  writtenRequestRequired: false,
};
const complaint = {
  since: "2026-10-30T11:20:00.000Z",
  liftReasons: ["asked_to_receive_again"] as const,
  noteRequired: true,
  writtenRequestRequired: true,
};
const bounceRule = { ...bounce, liftReasons: [...bounce.liftReasons] };
const complaintRule = { ...complaint, liftReasons: [...complaint.liftReasons] };

describe("lift email block form", () => {
  it("asks for a reason when several are offered, and preselects a single one", () => {
    expect(initialLiftDraft(bounceRule).reason).toBeNull();
    expect(initialLiftDraft(complaintRule).reason).toBe("asked_to_receive_again");
  });

  it("requires a note only for Other on a bounce", () => {
    expect(
      validateLift(bounceRule, { reason: "mailbox_fixed", note: "", writtenRequest: false }),
    ).toEqual({});
    expect(
      validateLift(bounceRule, { reason: "other", note: " ", writtenRequest: false }).note,
    ).toBe("Add a note to explain.");
  });

  it("requires where they asked and the written tick for a complaint", () => {
    const errors = validateLift(complaintRule, {
      reason: "asked_to_receive_again",
      note: "",
      writtenRequest: false,
    });
    expect(Object.keys(errors).sort()).toEqual(["note", "writtenRequest"]);
  });

  it("builds the body with the block as the screen saw it, or nothing while incomplete", () => {
    expect(toLiftBody(bounceRule, { reason: null, note: "", writtenRequest: false })).toBeNull();
    expect(
      toLiftBody(bounceRule, {
        reason: "mailbox_fixed",
        note: " set up again ",
        writtenRequest: false,
      }),
    ).toEqual({ reason: "mailbox_fixed", note: "set up again", expectedSince: bounce.since });
  });

  it("sends the written-request tick only for blocks that need it", () => {
    expect(
      toLiftBody(complaintRule, {
        reason: "asked_to_receive_again",
        note: "Email 2 Nov",
        writtenRequest: true,
      })?.writtenRequest,
    ).toBe(true);
  });
});
