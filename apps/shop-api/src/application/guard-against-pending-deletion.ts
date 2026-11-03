import { AccountDeletionPendingError } from "../errors/account-deletion-pending-error.js";
import type { PendingDeletionReader } from "./ports/pending-deletion.reader.js";

/**
 * Wraps a command that takes on something new for a signed-in person (an order, a resumed
 * checkout) so it is refused while they have asked to delete their account. The command itself
 * knows nothing about deletion; a new commitment is added to the rule by wrapping it here.
 */
export function guardAgainstPendingDeletion<Input extends { subject: string }, Output>(
  reader: PendingDeletionReader,
  command: (input: Input) => Promise<Output>,
): (input: Input) => Promise<Output> {
  return async (input) => {
    const requestedAt = await reader.requestedAt(input.subject);
    if (requestedAt) throw new AccountDeletionPendingError(requestedAt);
    return command(input);
  };
}
