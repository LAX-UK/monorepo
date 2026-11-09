import { createHash } from "node:crypto";
import {
  type FingerprintedRequest,
  collectionRequestCanonical,
} from "./collection-request-canonical.js";

/**
 * A digest of the request a booking was made with, stored beside its idempotency key. A repeat of
 * the same request (a double tap, a retry) has the same digest and gets the booking back; the same
 * key with anything different has another digest and is refused, so a reused key cannot make one
 * person's request return, or be mistaken for, another's.
 *
 * It covers what the person chose: account, place, time, the lots (in any order), who collects and
 * who made the request. It leaves out what the server fills in (the authorisation time, the policy
 * version, the capacity) because those can differ between two sends of the same request.
 */
export function collectionRequestFingerprint(request: FingerprintedRequest): string {
  const canonical = collectionRequestCanonical(request);
  return createHash("sha256").update(canonical).digest("hex");
}
