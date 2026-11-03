import type { AlertUrls } from "../ports.js";
import type { LinkKeyring } from "./codec.js";

const trim = (url: string) => url.replace(/\/$/, "");

/**
 * A product's links, all on its own web origin: the confirm page, the stop page (which is also
 * the address mail apps POST to for one-click), and the manage page when it has one.
 */
export function webAlertUrls(origin: string, managePath: string | null): AlertUrls {
  const base = trim(origin);
  const stop = (token: string) => `${base}/alerts/unsubscribe?t=${encodeURIComponent(token)}`;
  return {
    confirm: (token) => `${base}/alerts/confirm?t=${encodeURIComponent(token)}`,
    stop,
    oneClick: stop,
    manage: () => (managePath ? `${base}${managePath}` : null),
    site: (path) => `${base}${path}`,
  };
}

export type LinkKeyConfig = {
  keyId: string;
  secret: string;
  /** The key being retired during a rotation: still accepted, never used to sign. */
  previous?: { keyId: string; secret: string } | undefined;
};

/** The keyring for a secret and, during a rotation, the one before it. */
export function keyringFrom(config: LinkKeyConfig): LinkKeyring {
  const signing = { id: config.keyId, secret: config.secret };
  const previous = config.previous
    ? [{ id: config.previous.keyId, secret: config.previous.secret }]
    : [];
  return { signing, accepted: [signing, ...previous] };
}
