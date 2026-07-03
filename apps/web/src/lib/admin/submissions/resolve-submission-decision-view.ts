import type { ItemSubmissionStatus } from "@auction/types";

export type SubmissionDecisionViewMode =
  | "start-review"
  | "review"
  | "convert"
  | "converted"
  | "terminal"
  | "idle";

export type SubmissionDecisionShortcutAction = "accept" | "convert";

export type SubmissionDecisionView = {
  mode: SubmissionDecisionViewMode;
  showChecklist: boolean;
  shortcutsActive: boolean;
  shortcutSubmitAction: SubmissionDecisionShortcutAction | null;
  shortcutVerb: SubmissionDecisionShortcutAction | "accept";
};

export function resolveSubmissionDecisionView(
  status: ItemSubmissionStatus,
): SubmissionDecisionView {
  const showChecklist = status === "under_review" || status === "approved";
  const shortcutsActive = showChecklist;
  const shortcutVerb = status === "approved" ? "convert" : "accept";
  const shortcutSubmitAction =
    status === "under_review" ? "accept" : status === "approved" ? "convert" : null;

  switch (status) {
    case "submitted":
      return {
        mode: "start-review",
        showChecklist,
        shortcutsActive,
        shortcutSubmitAction,
        shortcutVerb,
      };
    case "under_review":
      return {
        mode: "review",
        showChecklist,
        shortcutsActive,
        shortcutSubmitAction,
        shortcutVerb,
      };
    case "approved":
      return {
        mode: "convert",
        showChecklist,
        shortcutsActive,
        shortcutSubmitAction,
        shortcutVerb,
      };
    case "converted":
      return {
        mode: "converted",
        showChecklist: false,
        shortcutsActive: false,
        shortcutSubmitAction: null,
        shortcutVerb: "accept",
      };
    case "rejected":
    case "withdrawn":
      return {
        mode: "terminal",
        showChecklist: false,
        shortcutsActive: false,
        shortcutSubmitAction: null,
        shortcutVerb: "accept",
      };
    default:
      return {
        mode: "idle",
        showChecklist: false,
        shortcutsActive: false,
        shortcutSubmitAction: null,
        shortcutVerb: "accept",
      };
  }
}
