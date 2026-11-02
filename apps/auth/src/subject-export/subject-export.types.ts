import type { SubjectExportPage } from "@auction/identity-contracts";

/**
 * One category of a person's data in LAX Account. Each category is its own class, registered once
 * (see {@link SubjectExportRegistry}), so adding a category is a new class, not an edit to a switch.
 */
export interface SubjectExportCategory {
  /** The category id from the shared contract; also the JSON file name. */
  readonly id: string;
  /** How many records the person has in this category right now. */
  count(subjectId: string): Promise<number>;
  /** One page of records, starting after `cursor` (null for the first page). */
  readPage(subjectId: string, cursor: string | null): Promise<SubjectExportPage>;
}

/** The cursor did not come from this category's earlier page. */
export class InvalidSubjectExportCursorError extends Error {
  constructor() {
    super("invalid_export_cursor");
    this.name = "InvalidSubjectExportCursorError";
  }
}
