import {
  ARTIST_APPLICATION_IMAGE_MAX_BYTES,
  ARTIST_APPLICATION_IMAGE_TYPES,
} from "@auction/shop-contracts";

/** The address lax.art's upload route answers on; the page posts each image here. */
export const ARTIST_APPLICATION_UPLOAD_PATH = "/for-artists/apply/images";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MEGABYTE = 1024 * 1024;

/** "10 MB", for the upload hint and the size error. */
export const ARTIST_APPLICATION_IMAGE_MAX_LABEL = `${ARTIST_APPLICATION_IMAGE_MAX_BYTES / MEGABYTE} MB`;

/** The image types an application takes, as the file picker's `accept`. */
export const ARTIST_APPLICATION_IMAGE_ACCEPT = ARTIST_APPLICATION_IMAGE_TYPES.join(",");

export type UploadCheck = { ok: true } | { ok: false; message: string };

/** Checks a file before it is sent: the same type and size rules the API applies. */
export function checkApplicationImage(file: {
  name: string;
  type: string;
  size: number;
}): UploadCheck {
  if (!(ARTIST_APPLICATION_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, message: `${file.name} is not a JPEG, PNG or WebP image.` };
  }
  if (file.size <= 0) return { ok: false, message: `${file.name} is empty.` };
  if (file.size > ARTIST_APPLICATION_IMAGE_MAX_BYTES) {
    return {
      ok: false,
      message: `${file.name} is larger than ${ARTIST_APPLICATION_IMAGE_MAX_LABEL}. Export a smaller copy and try again.`,
    };
  }
  return { ok: true };
}

/** An application id from the form, or null; anything else is never forwarded. */
export function applicationIdParam(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && UUID.test(value) ? value : null;
}

/**
 * Whether a browser request comes from lax.art itself. Uploads change data, so a page on another
 * site must not be able to post one with the visitor's cookies.
 */
export function isSameOriginRequest(
  headers: { get(name: string): string | null },
  host: string,
): boolean {
  const origin = headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}
