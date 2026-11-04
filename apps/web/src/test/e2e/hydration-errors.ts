/**
 * What a hydration failure looks like in the browser console. A production build prints React's
 * minified codes ("Minified React error #418"); a development build prints the full sentence.
 * 418 is a text mismatch, 419 a failed Suspense boundary, 422 and 423 the fallbacks to client
 * rendering, and 425 a text mismatch in a fragment.
 */
const HYDRATION_PATTERNS: readonly RegExp[] = [
  /Minified React error #(?:418|419|422|423|425)\b/,
  /Hydration failed because/i,
  /Text content does not match server-rendered HTML/i,
  /There was an error while hydrating/i,
  /A tree hydrated but some attributes of the server rendered HTML didn't match/i,
];

/** True when a console or page error message reports server and browser markup that differ. */
export function isHydrationError(message: string): boolean {
  return HYDRATION_PATTERNS.some((pattern) => pattern.test(message));
}

/** The hydration errors among `messages`, in the order they were printed. */
export function hydrationErrors(messages: readonly string[]): string[] {
  return messages.filter(isHydrationError);
}
