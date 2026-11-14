import type { StoredEmailAttachment } from "./templates/types/shared.js";
import type { TemplateName, TemplateVarsByName } from "./types.js";

export type { StoredEmailAttachment };

/** A file that travels with an email, ready for a mail provider (content is base64). */
export type EmailAttachment = {
  name: string;
  contentType: string;
  contentBase64: string;
};

type WithCalendar = {
  calendar?: { filename: string; method: "REQUEST" | "CANCEL"; content: string } | null;
};

/**
 * The files an email carries, worked out from the variables stored with it. Today that is the
 * calendar entry on collection emails; a mail client that understands the `method` adds,
 * updates or removes the entry itself. Nothing is stored twice: the file is built when the
 * variables are, and attached at send time.
 */
export function emailAttachments<T extends TemplateName>(
  _template: T,
  vars: TemplateVarsByName[T],
): EmailAttachment[] {
  const calendar = (vars as WithCalendar).calendar;
  if (!calendar?.content) return [];
  return [
    {
      name: calendar.filename,
      contentType: `text/calendar; method=${calendar.method}; charset=UTF-8`,
      contentBase64: Buffer.from(calendar.content, "utf8").toString("base64"),
    },
  ];
}

type WithStored = { storedAttachment?: StoredEmailAttachment | null };

const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9/._-]{0,255}$/;
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

/** The only templates that may carry a stored file, and where in storage that file must be. */
const STORED_ATTACHMENT_TEMPLATES: ReadonlySet<TemplateName> = new Set(["bid-invoice-issued"]);
const STORED_ATTACHMENT_PREFIX = "accounting/";
const STORED_ATTACHMENT_SUFFIX = ".pdf";

/**
 * Files in LAX's document storage an email carries (the stored copy of a Books invoice). The
 * sender reads each by its key when it sends. Only the "Your invoice" email may carry one (any
 * other template's is never read), and only a PDF under `accounting/`; a key or name that is not
 * plainly safe is refused here rather than read or put in a header.
 */
export function storedEmailAttachments<T extends TemplateName>(
  template: T,
  vars: TemplateVarsByName[T],
): StoredEmailAttachment[] {
  if (!STORED_ATTACHMENT_TEMPLATES.has(template)) return [];
  const stored = (vars as WithStored).storedAttachment;
  if (!stored) return [];
  if (
    !SAFE_KEY.test(stored.storageKey) ||
    stored.storageKey.includes("..") ||
    !stored.storageKey.startsWith(STORED_ATTACHMENT_PREFIX) ||
    !stored.storageKey.endsWith(STORED_ATTACHMENT_SUFFIX) ||
    !SAFE_NAME.test(stored.filename) ||
    stored.contentType !== "application/pdf"
  ) {
    throw new Error("stored_email_attachment_invalid");
  }
  return [stored];
}
