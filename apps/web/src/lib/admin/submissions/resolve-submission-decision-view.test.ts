import { itemSubmissionStatuses } from "@auction/types";
import { describe, expect, it } from "vitest";
import { resolveSubmissionDecisionView } from "./resolve-submission-decision-view";

describe("resolveSubmissionDecisionView", () => {
  it("maps every known submission status", () => {
    for (const status of itemSubmissionStatuses) {
      expect(resolveSubmissionDecisionView(status)).toMatchObject({
        mode: expect.any(String),
      });
    }
  });

  it("submitted starts review without checklist or shortcuts", () => {
    expect(resolveSubmissionDecisionView("submitted")).toEqual({
      mode: "start-review",
      showChecklist: false,
      shortcutsActive: false,
      shortcutSubmitAction: null,
      shortcutVerb: "accept",
    });
  });

  it("under_review enables review mode with accept shortcuts", () => {
    expect(resolveSubmissionDecisionView("under_review")).toEqual({
      mode: "review",
      showChecklist: true,
      shortcutsActive: true,
      shortcutSubmitAction: "accept",
      shortcutVerb: "accept",
    });
  });

  it("approved enables convert mode with convert shortcuts", () => {
    expect(resolveSubmissionDecisionView("approved")).toEqual({
      mode: "convert",
      showChecklist: true,
      shortcutsActive: true,
      shortcutSubmitAction: "convert",
      shortcutVerb: "convert",
    });
  });

  it("converted opens lot without checklist or shortcuts", () => {
    expect(resolveSubmissionDecisionView("converted")).toEqual({
      mode: "converted",
      showChecklist: false,
      shortcutsActive: false,
      shortcutSubmitAction: null,
      shortcutVerb: "accept",
    });
  });

  it("rejected and withdrawn are terminal", () => {
    expect(resolveSubmissionDecisionView("rejected")).toEqual({
      mode: "terminal",
      showChecklist: false,
      shortcutsActive: false,
      shortcutSubmitAction: null,
      shortcutVerb: "accept",
    });
    expect(resolveSubmissionDecisionView("withdrawn")).toEqual({
      mode: "terminal",
      showChecklist: false,
      shortcutsActive: false,
      shortcutSubmitAction: null,
      shortcutVerb: "accept",
    });
  });

  it("draft is idle", () => {
    expect(resolveSubmissionDecisionView("draft")).toEqual({
      mode: "idle",
      showChecklist: false,
      shortcutsActive: false,
      shortcutSubmitAction: null,
      shortcutVerb: "accept",
    });
  });
});
