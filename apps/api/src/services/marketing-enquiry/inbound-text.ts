/**
 * Turns what arrives on the inbound webhook into plain text that is safe to store and show.
 * Output is text only: no markup survives, control characters are removed and the length is
 * capped. Staff screens still escape it when they render it.
 */

export const INBOUND_BODY_MAX_CHARS = 20_000;
export const INBOUND_SUBJECT_MAX_CHARS = 300;
export const INBOUND_FILENAME_MAX_CHARS = 200;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,6});/gi, (whole, body: string) => {
    if (body.startsWith("#")) {
      const code =
        body[1]?.toLowerCase() === "x"
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return " ";
      return String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/** Removes tags, and the content of script, style and head blocks. Repeats until nothing changes. */
export function stripHtml(html: string): string {
  let text = html;
  for (let i = 0; i < 5; i += 1) {
    const before = text;
    text = text
      .replace(/<(script|style|head|title|template|iframe|object|embed)\b[\s\S]*?<\/\1\s*>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<br\s*\/?>|<\/(p|div|li|tr|h[1-6]|blockquote)\s*>/gi, "\n")
      .replace(/<[^>]*>/g, " ");
    if (text === before) break;
  }
  // An unterminated tag or comment at the end is dropped rather than shown half-parsed.
  return text.replace(/<[^>]*$/, " ");
}

/** Control characters other than tab and newline, bidirectional overrides and zero-width marks. */
const UNWANTED_CHARS =
  // biome-ignore lint/suspicious/noControlCharactersInRegex: removing them is the point
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]/g;

/** Plain text, from text or HTML, with a character cap. */
export function sanitiseInboundText(raw: string | null | undefined, maxChars: number): string {
  if (!raw) return "";
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(raw);
  let text = looksLikeHtml ? decodeEntities(stripHtml(raw)) : raw;
  // Entities decoded from markup can themselves spell a tag; no markup is kept.
  if (looksLikeHtml) text = stripHtml(text);
  text = text
    .replace(/\r\n?/g, "\n")
    .replace(UNWANTED_CHARS, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.length > maxChars ? `${text.slice(0, maxChars - 1).trimEnd()}…` : text;
}

/** A one-line value (subject, file name): text only, whitespace collapsed, capped. */
export function sanitiseInboundLine(raw: string | null | undefined, maxChars: number): string {
  return sanitiseInboundText(raw, maxChars * 2)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxChars);
}

/** The ids a In-Reply-To or References header quotes, without angle brackets, in order. */
export function messageIdsFromHeader(value: string | null | undefined): string[] {
  if (!value) return [];
  const ids: string[] = [];
  for (const match of value.matchAll(/<([^<>\s]{1,300})>/g)) {
    if (match[1]) ids.push(match[1]);
  }
  return ids.slice(-20);
}

/**
 * Postmark's MessageID is a UUID and the Message-ID header it puts on outgoing mail is
 * `<uuid@host>`; the reply quotes the header. This is the part before the `@`.
 */
export function providerIdFromMessageId(messageId: string): string {
  const at = messageId.indexOf("@");
  return (at === -1 ? messageId : messageId.slice(0, at)).toLowerCase();
}
