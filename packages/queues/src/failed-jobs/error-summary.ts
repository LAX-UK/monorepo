import { scrubText } from "./scrub.js";

const SUMMARY_MAX = 160;
const MESSAGE_MAX = 1_200;

/** The first line of an error, scrubbed and cut at a word, for the list. */
export function summariseError(message: string | null | undefined): string {
  const firstLine =
    (message ?? "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? "";
  if (!firstLine) return "No error was recorded.";
  const clean = scrubText(firstLine);
  if (clean.length <= SUMMARY_MAX) return clean;
  const cut = clean.slice(0, SUMMARY_MAX);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > SUMMARY_MAX * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** The whole error for the job page: scrubbed, and capped so a stack never floods the page. */
export function scrubErrorMessage(message: string | null | undefined): string {
  const text = (message ?? "").trim();
  if (!text) return "No error was recorded.";
  const clean = scrubText(text);
  return clean.length <= MESSAGE_MAX ? clean : `${clean.slice(0, MESSAGE_MAX).trimEnd()}…`;
}
