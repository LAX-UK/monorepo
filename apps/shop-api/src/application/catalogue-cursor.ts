export type CatalogueCursor = {
  createdAt: Date;
  id: string;
  /**
   * The position to the microsecond, as `YYYY-MM-DDTHH:MM:SS.ffffffZ`. A `Date` only holds
   * milliseconds, so lists that page on the raw column carry this. Cursors issued before it existed
   * decode with the millisecond value padded with zeros.
   */
  createdAtMicros?: string | undefined;
};

const CURSOR_TIMESTAMP = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?Z$/;

/** Normalises a cursor timestamp to six fractional digits, or null if it is not a UTC ISO timestamp. */
export function normaliseCursorMicros(value: string): string | null {
  const match = CURSOR_TIMESTAMP.exec(value);
  if (!match) return null;
  return `${match[1]}.${(match[2] ?? "").padEnd(6, "0")}Z`;
}

export class InvalidCatalogueCursorError extends Error {
  constructor() {
    super("The catalogue cursor is invalid");
    this.name = "InvalidCatalogueCursorError";
  }
}

export function truncateCatalogueCursorDate(date: Date): Date {
  return new Date(date.getTime());
}

export function encodeCatalogueCursor(cursor: CatalogueCursor): string {
  const createdAt = truncateCatalogueCursorDate(cursor.createdAt);
  return Buffer.from(
    JSON.stringify({
      createdAt: cursor.createdAtMicros ?? createdAt.toISOString(),
      id: cursor.id,
    }),
  ).toString("base64url");
}

export type SortLabelCursor = {
  sortOrder: number;
  label: string;
  id: string;
};

export function encodeSortLabelCursor(cursor: SortLabelCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeSortLabelCursor(value: string | undefined): SortLabelCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
      sortOrder?: unknown;
      label?: unknown;
      id?: unknown;
    };
    if (
      typeof parsed.sortOrder !== "number" ||
      typeof parsed.label !== "string" ||
      typeof parsed.id !== "string" ||
      !parsed.id
    ) {
      throw new InvalidCatalogueCursorError();
    }
    return { sortOrder: parsed.sortOrder, label: parsed.label, id: parsed.id };
  } catch (error) {
    if (error instanceof InvalidCatalogueCursorError) throw error;
    throw new InvalidCatalogueCursorError();
  }
}

export function decodeCatalogueCursor(value: string | undefined): CatalogueCursor | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
      createdAt?: unknown;
      id?: unknown;
    };
    if (typeof parsed.createdAt !== "string" || typeof parsed.id !== "string" || !parsed.id) {
      throw new InvalidCatalogueCursorError();
    }
    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime())) {
      throw new InvalidCatalogueCursorError();
    }
    // Only a timestamp finer than a millisecond carries extra information; an older cursor decodes
    // exactly as before and the list falls back to its millisecond value.
    const micros = normaliseCursorMicros(parsed.createdAt);
    const createdAtMicros = micros && !micros.endsWith("000Z") ? micros : undefined;
    return {
      createdAt: truncateCatalogueCursorDate(createdAt),
      id: parsed.id,
      ...(createdAtMicros ? { createdAtMicros } : {}),
    };
  } catch (error) {
    if (error instanceof InvalidCatalogueCursorError) throw error;
    throw new InvalidCatalogueCursorError();
  }
}

/** Keyset position in a list sorted by name: the last name shown and its id as a tie-break. */
export type NameCursor = {
  name: string;
  id: string;
};

export function encodeNameCursor(cursor: NameCursor): string {
  return Buffer.from(JSON.stringify({ name: cursor.name, id: cursor.id })).toString("base64url");
}

export function decodeNameCursor(value: string | undefined): NameCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
      name?: unknown;
      id?: unknown;
    };
    if (typeof parsed.name !== "string" || typeof parsed.id !== "string" || !parsed.id) {
      throw new InvalidCatalogueCursorError();
    }
    return { name: parsed.name, id: parsed.id };
  } catch (error) {
    if (error instanceof InvalidCatalogueCursorError) throw error;
    throw new InvalidCatalogueCursorError();
  }
}
