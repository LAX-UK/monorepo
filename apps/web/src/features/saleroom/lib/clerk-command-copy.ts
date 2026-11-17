/** What the clerk console and door check-in say when a command does not go through. */
export const CLERK_COMMAND_COPY = {
  unreachable: "The saleroom could not be reached. Check the connection, then try again.",
  sessionExpired: "Your session has ended. Sign in again to continue.",
  /** Shown while the console re-reads the room after a command that did not answer cleanly. */
  outcomeUnknown: "Outcome unknown, checking the room…",
  lotNotOnBlock: "This lot is no longer on the block",
} as const;
