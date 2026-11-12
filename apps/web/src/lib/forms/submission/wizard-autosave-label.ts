import type { AutosaveStatus } from "@/lib/forms/submission/use-submission-wizard-controller";
import { formatTime, runtimeTimeZone } from "@auction/datetime";

export function wizardAutosaveLabel(status: AutosaveStatus, lastSavedAt: Date | null): string {
  if (status === "saving") return "Saving…";
  if (status === "dirty") return "Unsaved changes";
  if (status === "error") return "Could not save";
  if (status === "saved" && lastSavedAt) {
    return `Saved · ${formatTime(lastSavedAt, runtimeTimeZone())}`;
  }
  return "";
}
