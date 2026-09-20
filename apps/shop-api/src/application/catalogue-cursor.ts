export type CatalogueCursor = {
  createdAt: Date;
  id: string;
};

export class InvalidCatalogueCursorError extends Error {
  constructor() {
    super("The catalogue cursor is invalid");
    this.name = "InvalidCatalogueCursorError";
  }
}

export function encodeCatalogueCursor(cursor: CatalogueCursor): string {
  return Buffer.from(
    JSON.stringify({ createdAt: cursor.createdAt.toISOString(), id: cursor.id }),
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
    return { createdAt, id: parsed.id };
  } catch (error) {
    if (error instanceof InvalidCatalogueCursorError) throw error;
    throw new InvalidCatalogueCursorError();
  }
}
