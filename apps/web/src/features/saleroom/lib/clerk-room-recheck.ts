import { CLERK_COMMAND_COPY } from "@/features/saleroom/lib/clerk-command-copy";
import { notify } from "@/lib/ui/notify";
import { createContext } from "react";

/**
 * Re-reads the room from the server: the console refreshes the page (lots, bookings, roster) and
 * asks the API for the session again. Provided by the clerk console to every command control.
 */
export type ClerkRoomRecheck = () => Promise<unknown>;

export const ClerkRoomRecheckContext = createContext<ClerkRoomRecheck | null>(null);

/**
 * A clerk command that did not answer 2xx, or did not answer at all, may still have landed: the
 * response can be lost after the server acted. Never claim success and never send it again. Say
 * the outcome is unknown, read the room again so the console shows what the server holds, and
 * only then show the error, in the same toast.
 */
export async function settleUnknownOutcome(
  recheck: ClerkRoomRecheck | null,
  error: string,
  toastId: string,
): Promise<void> {
  notify.loading(CLERK_COMMAND_COPY.outcomeUnknown, { id: toastId });
  try {
    await recheck?.();
  } catch {
    // The error below still tells the clerk the command did not answer cleanly.
  }
  notify.error(error, { id: toastId });
}
