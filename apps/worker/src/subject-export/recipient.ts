import { readFile, stat } from "node:fs/promises";
import type { ExportStaging } from "./export-staging.js";

const MAX_BYTES = 1024 * 1024;

type Envelope = { records?: unknown };

async function firstRecord(
  staging: ExportStaging,
  zipPath: string,
): Promise<Record<string, unknown> | null> {
  const entry = staging.entries.find((candidate) => candidate.zipPath === zipPath);
  if (!entry || entry.bytes > MAX_BYTES) return null;
  await stat(entry.diskPath);
  const parsed = JSON.parse(await readFile(entry.diskPath, "utf8")) as Envelope;
  const [first] = Array.isArray(parsed.records) ? parsed.records : [];
  return first && typeof first === "object" ? (first as Record<string, unknown>) : null;
}

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

/**
 * Who the copy is for, read back from the person's own account files so the summary can greet them
 * by name. Missing is fine: the summary then says nothing instead of guessing.
 */
export async function readRecipient(
  staging: ExportStaging,
): Promise<{ name: string | null; email: string | null }> {
  const [profile, contact] = await Promise.all([
    firstRecord(staging, "account/profile.json"),
    firstRecord(staging, "account/contact.json"),
  ]);
  return { name: text(profile?.name), email: text(contact?.email) };
}
