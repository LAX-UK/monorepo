import type { EnquiryKind } from "@auction/shop-contracts";
import { InvalidCatalogueCursorError } from "./catalogue-cursor.js";

/**
 * The inbox unions two tables, so a row is placed by `(createdAt, kind, id)`. `createdAt` is the
 * database's own text rendering at microsecond precision: a JavaScript Date would round it to
 * milliseconds and let rows created within one millisecond skip or repeat across a page boundary.
 */
export type EnquiryInboxCursor = { createdAt: string; kind: EnquiryKind; id: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MICRO_ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;

export function encodeEnquiryInboxCursor(cursor: EnquiryInboxCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeEnquiryInboxCursor(value: string | undefined): EnquiryInboxCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
      createdAt?: unknown;
      kind?: unknown;
      id?: unknown;
    };
    if (
      typeof parsed.createdAt === "string" &&
      MICRO_ISO_PATTERN.test(parsed.createdAt) &&
      (parsed.kind === "general" || parsed.kind === "artwork") &&
      typeof parsed.id === "string" &&
      UUID_PATTERN.test(parsed.id)
    ) {
      return { createdAt: parsed.createdAt, kind: parsed.kind, id: parsed.id };
    }
  } catch {
    // Falls through to the shared invalid-cursor error below.
  }
  throw new InvalidCatalogueCursorError();
}
