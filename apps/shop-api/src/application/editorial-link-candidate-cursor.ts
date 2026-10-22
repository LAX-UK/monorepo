import { InvalidCatalogueCursorError } from "./catalogue-cursor.js";

/** Candidates sort by title then id, so a title shared by several records still pages without gaps. */
export type EditorialLinkCandidateCursor = { title: string; id: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function encodeEditorialLinkCandidateCursor(cursor: EditorialLinkCandidateCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeEditorialLinkCandidateCursor(
  value: string | null,
): EditorialLinkCandidateCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
      title?: unknown;
      id?: unknown;
    };
    if (
      typeof parsed.title === "string" &&
      typeof parsed.id === "string" &&
      UUID_PATTERN.test(parsed.id)
    ) {
      return { title: parsed.title, id: parsed.id };
    }
  } catch {
    // Falls through to the shared invalid-cursor error below.
  }
  throw new InvalidCatalogueCursorError();
}
