import "server-only";

import { CLIENT_FLASH } from "./client-flash";
import type { Flash, FlashKind } from "./flash-token";
import { createFlashChannel } from "./flash.server";

const channel = createFlashChannel(CLIENT_FLASH);

/** Leaves a message for the seller page at `path` and sends the person there. */
export function redirectWithClientFlash(
  path: string,
  kind: FlashKind,
  message: string,
): Promise<never> {
  return channel.redirectWithFlash(path, kind, message);
}

/** The message waiting for this page, if any. Reading does not remove it. */
export function readClientFlashForPath(path: string): Promise<Flash | null> {
  return channel.readFlashForPath(path);
}

/** Removes the message stored for `path`. Only a route handler or action may call this. */
export function dropClientFlash(path: string): Promise<boolean> {
  return channel.dropFlash(path);
}
