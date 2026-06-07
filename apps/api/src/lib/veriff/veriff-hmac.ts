import { createHmac } from "node:crypto";

/** Session-level HMAC used by Veriff GET/PATCH session endpoints. */
export function signVeriffSessionId(sessionId: string, sharedSecret: string): string {
  return createHmac("sha256", sharedSecret).update(sessionId).digest("hex");
}
