import type { TemplateName, TemplateVarsByName } from "./types.js";

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
