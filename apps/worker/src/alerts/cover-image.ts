import sharp from "sharp";

/**
 * The width of the cover picture an email links to: a little over the 532 pixels it is shown at,
 * and light enough for a mail app on a phone connection.
 */
export const EMAIL_COVER_WIDTH = 640;
/** A stored original larger than this is not read for an email copy. */
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

/**
 * Where the email copy of a stored picture lives: beside the original, so the bucket serves it
 * under the same public prefix, and named after it, so it is made once.
 */
export function emailCoverKey(sourceKey: string): string {
  return `${sourceKey.replace(/\.[A-Za-z0-9]+$/, "")}.email-${EMAIL_COVER_WIDTH}.jpg`;
}

/**
 * The storage key behind a cover value: a key as stored, or an address on our own media host.
 * Null for a picture on any other host, which the email does not fetch.
 */
export function storageKeyOf(value: string, mediaBaseUrl: string): string | null {
  const key = value.trim();
  if (!key) return null;
  if (!/^https?:\/\//i.test(key)) return key.replace(/^\/+/, "");
  const base = `${mediaBaseUrl.replace(/\/+$/, "")}/`;
  return key.startsWith(base) ? key.slice(base.length) || null : null;
}

/**
 * A 640 pixel wide baseline JPEG in sRGB on white: every mail app shows it, Outlook on Windows
 * included, whatever the original's format, orientation or transparency.
 */
export async function renderEmailCover(bytes: Buffer): Promise<Buffer> {
  return sharp(bytes)
    .rotate()
    .resize({ width: EMAIL_COVER_WIDTH, withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .toColourspace("srgb")
    .jpeg({ quality: 80, progressive: false, optimiseCoding: true })
    .toBuffer();
}

export type EmailCoverStorage = {
  headObject(key: string): Promise<unknown | null>;
  getObjectBytes(key: string, maxBytes: number): Promise<Buffer | null>;
  putObject(key: string, body: Buffer, contentType: string): Promise<unknown>;
};

/**
 * The address of a sale's cover picture for an email: the media host's own absolute address of a
 * 640 pixel JPEG copy, made from the stored original the first time it is asked for. Never the
 * site's image optimiser, which picks a format from the request and could hand a mail app WebP.
 * Null (the email shows no picture) when storage has no public address, the picture is on
 * another host, or the copy cannot be made.
 */
export function createEmailCoverUrls(deps: {
  storage: EmailCoverStorage;
  /** Where stored pictures are served from; null when storage has no public address. */
  mediaBaseUrl: string | null;
  render?: (bytes: Buffer) => Promise<Buffer>;
  log?: { warn(fields: Record<string, unknown>, message: string): void };
}): (value: string) => Promise<string | null> {
  const render = deps.render ?? renderEmailCover;
  return async (value) => {
    const base = deps.mediaBaseUrl?.replace(/\/+$/, "");
    if (!base) return null;
    const sourceKey = storageKeyOf(value, base);
    if (!sourceKey) return null;
    const copyKey = emailCoverKey(sourceKey);
    try {
      if (!(await deps.storage.headObject(copyKey))) {
        const original = await deps.storage.getObjectBytes(sourceKey, MAX_SOURCE_BYTES);
        if (!original) return null;
        await deps.storage.putObject(copyKey, await render(original), "image/jpeg");
      }
      return `${base}/${copyKey}`;
    } catch (error) {
      deps.log?.warn(
        { err: error instanceof Error ? error.message : String(error) },
        "email cover copy failed; the digest goes without the picture",
      );
      return null;
    }
  };
}
