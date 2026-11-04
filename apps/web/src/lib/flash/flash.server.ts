import "server-only";

import { createHmac } from "node:crypto";
import { bffSecretKeyMaterial } from "@/lib/bff/config.server";
import { bidSessionCookieUsesSecureTransport } from "@/lib/bff/session-cookie.constants";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { FlashAudience } from "./flash-audience";
import { clearFlash, readFlash, writeFlash } from "./flash-cookie";
import type { Flash, FlashKind } from "./flash-token";

export type FlashChannel = {
  /** Leaves a message for the page at `path` and sends the person there. */
  redirectWithFlash(path: string, kind: FlashKind, message: string): Promise<never>;
  /** The message waiting for this page, if any. Reading does not remove it; see `dropFlash`. */
  readFlashForPath(path: string): Promise<Flash | null>;
  /** Removes the message stored for `path`. Only a route handler or action may call this. */
  dropFlash(path: string): Promise<boolean>;
};

/**
 * The flash channel for one audience. The words travel in a signed one-minute cookie, never in
 * the URL, and the signing key is derived from the server secret with the audience's own context.
 */
export function createFlashChannel(audience: FlashAudience): FlashChannel {
  const env = () => ({
    key: createHmac("sha256", bffSecretKeyMaterial()).update(audience.keyContext).digest(),
    nowMs: Date.now(),
    secure: bidSessionCookieUsesSecureTransport(),
  });
  return {
    async redirectWithFlash(path, kind, message) {
      writeFlash(audience, await cookies(), env(), { kind, message, path });
      redirect(path);
    },
    async readFlashForPath(path) {
      return readFlash(audience, await cookies(), env(), path);
    },
    async dropFlash(path) {
      return clearFlash(audience, await cookies(), env(), path);
    },
  };
}
