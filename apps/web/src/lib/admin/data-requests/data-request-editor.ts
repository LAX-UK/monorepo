import type { DataRequestRecord } from "@auction/identity-contracts/data-requests";

/**
 * Who last changed a request, from its history (oldest first): the newest entry a named person
 * made. The system's own entries and a person's own download carry no staff name and are passed
 * over. Null when nobody is named.
 */
export function lastEditorName(timeline: DataRequestRecord["timeline"]): string | null {
  for (let index = timeline.length - 1; index >= 0; index -= 1) {
    const name = timeline[index]?.actorName?.trim();
    if (name) return name;
  }
  return null;
}
