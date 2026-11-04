import "server-only";

import type { Flash, FlashKind } from "@/lib/flash/flash-token";
import { createFlashChannel } from "@/lib/flash/flash.server";
import { ADMIN_FLASH } from "./admin-flash";

const channel = createFlashChannel(ADMIN_FLASH);

/** Leaves a message for the staff page at `path` and sends the staff member there. */
export function redirectWithAdminFlash(
  path: string,
  kind: FlashKind,
  message: string,
): Promise<never> {
  return channel.redirectWithFlash(path, kind, message);
}

/** The message waiting for this staff page, if any. Reading does not remove it. */
export function readAdminFlashForPath(path: string): Promise<Flash | null> {
  return channel.readFlashForPath(path);
}

/** Removes the message stored for `path`. Only a route handler or action may call this. */
export function dropAdminFlash(path: string): Promise<boolean> {
  return channel.dropFlash(path);
}
