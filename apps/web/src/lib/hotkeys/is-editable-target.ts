/** Returns true when the event target is a text-entry control (skip global hotkeys). */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  if (target.closest("[contenteditable='true']")) return true;
  if (target.closest("[role='textbox']")) return true;
  if (target.closest("[cmdk-input]")) return true;
  return false;
}
