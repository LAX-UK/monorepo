import type { DataRequestListQuery } from "@auction/identity-contracts";
import type { ListPosition, MergedRequestRow } from "./data-request.ports.js";

type Sort = DataRequestListQuery["sort"];

/** Requests with no due date sort last in the due order. */
export const NO_DUE_DATE_KEY = "9999-12-31";

export class InvalidDataRequestCursorError extends Error {
  constructor() {
    super("Invalid data request cursor");
    this.name = "InvalidDataRequestCursorError";
  }
}

/** The value a row is ordered by: its due date (none last), or the day it was requested. */
export function sortKey(sort: Sort, row: Pick<MergedRequestRow, "dueOn" | "requestedOn">): string {
  return sort === "due" ? (row.dueOn ?? NO_DUE_DATE_KEY) : row.requestedOn;
}

export function encodeCursor(sort: Sort, row: MergedRequestRow): string {
  const position: [Sort, string, string] = [sort, sortKey(sort, row), row.reference];
  return Buffer.from(JSON.stringify(position)).toString("base64url");
}

/** Reads a cursor made for the same sort; any other value is refused rather than guessed at. */
export function decodeCursor(sort: Sort, cursor: string): ListPosition {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (
      Array.isArray(parsed) &&
      parsed.length === 3 &&
      parsed[0] === sort &&
      typeof parsed[1] === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(parsed[1]) &&
      typeof parsed[2] === "string" &&
      /^D[LR]-[0-9A-F]{4,}$/.test(parsed[2])
    ) {
      return { key: parsed[1], reference: parsed[2] };
    }
  } catch {
    // Falls through to the error below.
  }
  throw new InvalidDataRequestCursorError();
}
