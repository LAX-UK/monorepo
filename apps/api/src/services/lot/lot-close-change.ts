import type { Lot } from "@auction/types";
import type { ILotNotificationSender } from "../interfaces/notifications.js";

/**
 * Publishes a lot's new close to every open page: the same close-time event a late bid's extension
 * sends (the new close, then the server clock on the way out), so the lot page, the phone bar and
 * the lists that show the close all follow a staff change without a reload.
 */
export type LotCloseNotifier = Pick<ILotNotificationSender, "notifyLotExtended">;

/** Statuses with a public lot page whose countdown reads the close. */
const PUBLIC_CLOSE: ReadonlySet<Lot["status"]> = new Set(["scheduled", "active"]);

/**
 * After staff saved a change to a lot: announces the close when it moved. `closesAt` is the close
 * the lot now has (for a lot ended by staff, the moment it ended). Best effort: the change is saved
 * either way, and a page that misses the event reads the close on its next refetch.
 */
export async function announceLotCloseChange(
  notifier: LotCloseNotifier | null | undefined,
  input: { before: Pick<Lot, "status" | "endTime">; lot: Lot; closesAt: Date },
): Promise<void> {
  if (!notifier) return;
  if (!PUBLIC_CLOSE.has(input.before.status)) return;
  if (input.closesAt.getTime() === new Date(input.before.endTime).getTime()) return;
  try {
    await notifier.notifyLotExtended(input.lot, input.closesAt);
  } catch (error) {
    console.error("[lot-close-change] publish failed", error);
  }
}
