import { safeRelativeReturnPath } from "@auction/identity-rp/safe-return-path";

const DEFAULT_RETURN_TO = "/overview";

/** Same-origin relative path only; anything that could leave the origin becomes the fallback. */
export function safeReturnTo(raw: string | null | undefined, fallback = DEFAULT_RETURN_TO): string {
  return safeRelativeReturnPath(raw) ?? fallback;
}
