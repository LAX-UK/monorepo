import { describe, expect, it } from "vitest";
import { enquiryRecordActions } from "./enquiry-actions";

const work = { canWork: true };

describe("enquiryRecordActions", () => {
  it("offers a new enquiry the next step, the other status, closing and handing over", () => {
    expect(
      enquiryRecordActions(
        { status: "new", nextStatuses: ["in_progress", "waiting_on_client", "closed"] },
        work,
      ),
    ).toEqual({
      access: "full",
      primary: { kind: "start", to: "in_progress" },
      moves: ["waiting_on_client"],
      canClose: true,
      canAssign: true,
      canNote: true,
    });
  });

  it("offers an enquiry in progress both statuses and closing, with no next step", () => {
    const actions = enquiryRecordActions(
      { status: "in_progress", nextStatuses: ["waiting_on_client", "closed", "converted"] },
      work,
    );
    expect(actions.primary).toBeNull();
    expect(actions.moves).toEqual(["waiting_on_client"]);
    expect(actions.canClose).toBe(true);
  });

  it("never offers conversion by hand", () => {
    const actions = enquiryRecordActions(
      { status: "waiting_on_client", nextStatuses: ["in_progress", "closed", "converted"] },
      work,
    );
    expect(actions.moves).toEqual(["in_progress"]);
  });

  it("offers a closed enquiry Reopen, and no assigning or closing", () => {
    expect(
      enquiryRecordActions({ status: "closed", nextStatuses: ["in_progress"] }, work),
    ).toMatchObject({
      primary: { kind: "reopen", to: "in_progress" },
      moves: [],
      canClose: false,
      canAssign: false,
      canNote: true,
    });
  });

  it("offers a converted enquiry nothing but notes", () => {
    expect(enquiryRecordActions({ status: "converted", nextStatuses: [] }, work)).toMatchObject({
      primary: null,
      moves: [],
      canClose: false,
      canAssign: false,
    });
  });

  it("is view only without the capability to work", () => {
    expect(
      enquiryRecordActions(
        { status: "new", nextStatuses: ["in_progress", "closed"] },
        { canWork: false },
      ),
    ).toEqual({
      access: "read-only",
      primary: null,
      moves: [],
      canClose: false,
      canAssign: false,
      canNote: false,
    });
  });
});
