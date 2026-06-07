import type { AutosaveStatus } from "@/lib/forms/submission/use-submission-wizard-controller";

export function wizardAutosaveLabel(status: AutosaveStatus, lastSavedAt: Date | null): string {
  if (status === "saving") return "Saving…";
  if (status === "dirty") return "Unsaved changes";
  if (status === "error") return "Could not save";
  if (status === "saved" && lastSavedAt) {
    return `Saved · ${lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
  return "";
}
