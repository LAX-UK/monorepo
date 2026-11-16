/**
 * True when an error says the page called a server action the server no longer has: the page
 * was loaded from an earlier build and a deploy has since replaced it. Next answers the action's
 * POST with 404 and the client throws `UnrecognizedActionError` ("Server Action ... was not
 * found on the server"). Retrying cannot help, because the page still holds the old action id;
 * only a fresh page from the current build can. A wrapper that keeps the original as `cause` is
 * looked through.
 */
export function isStaleServerActionError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 3 && current instanceof Error; depth += 1) {
    if (current.name === "UnrecognizedActionError") return true;
    if (/Server Action .* was not found on the server/i.test(current.message)) return true;
    if (current.message.includes("failed-to-find-server-action")) return true;
    current = current.cause;
  }
  return false;
}
