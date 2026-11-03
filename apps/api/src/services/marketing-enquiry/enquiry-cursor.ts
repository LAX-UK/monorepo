/** An opaque position in the enquiry list: the id of the last enquiry on the page. */
export function encodeEnquiryCursor(row: { id: string }): string {
  return Buffer.from(row.id).toString("base64url");
}

/** The enquiry a cursor names, or null when it is not one we issued. */
export function decodeEnquiryCursor(cursor: string): string | null {
  const id = Buffer.from(cursor, "base64url").toString("utf8");
  return /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}
