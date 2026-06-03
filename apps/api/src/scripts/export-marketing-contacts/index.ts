/**
 * Backfill existing registered users into the marketing-contacts audience (Plan B).
 *
 * CSV (default):  pnpm exec tsx src/scripts/export-marketing-contacts/index.ts
 * Brevo import:   pnpm exec tsx src/scripts/export-marketing-contacts/index.ts --brevo
 * Dry run:        pnpm exec tsx src/scripts/export-marketing-contacts/index.ts --dry-run
 *
 * Env: DATABASE_URL (always); BREVO_API_KEY + BREVO_LIST_ID (for --brevo).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createDb } from "@auction/db";
import { type MarketingContactRow, contactsToCsv, loadEligibleMarketingContacts } from "./query.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BREVO_BASE_URL = "https://api.brevo.com/v3";
const DEFAULT_CHUNK = 1000;

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  const toBrevo = args.has("--brevo");
  const chunkSize = parseChunk(process.argv) ?? DEFAULT_CHUNK;

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }

  const db = createDb(url);
  const contacts = await loadEligibleMarketingContacts(db);
  console.log(`Eligible marketing contacts: ${contacts.length}`);

  if (dryRun) return;

  if (toBrevo) {
    await pushToBrevo(contacts, chunkSize);
    return;
  }

  const outDir = join(__dirname, "..", "..", "..", "tmp");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "marketing-contacts.csv");
  writeFileSync(outPath, contactsToCsv(contacts), "utf8");
  console.log(`Wrote ${contacts.length} contacts to ${outPath}`);
}

function parseChunk(argv: string[]): number | null {
  const arg = argv.find((a) => a.startsWith("--chunk="));
  if (!arg) return null;
  const n = Number(arg.slice("--chunk=".length));
  return Number.isInteger(n) && n > 0 ? n : null;
}

async function pushToBrevo(rows: MarketingContactRow[], chunkSize: number): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  const listId = Number(process.env.BREVO_LIST_ID);
  if (!apiKey || !Number.isInteger(listId) || listId <= 0) {
    console.error("BREVO_API_KEY and BREVO_LIST_ID are required for --brevo");
    process.exit(1);
  }

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const res = await fetch(`${BREVO_BASE_URL}/contacts/import`, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        fileBody: contactsToCsv(chunk),
        listIds: [listId],
        updateExistingContacts: true,
        emptyContactsAttributes: false,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => `HTTP ${res.status}`);
      throw new Error(`Brevo import failed (${res.status}) for chunk ${i / chunkSize}: ${body}`);
    }
    const json = (await res.json().catch(() => ({}))) as { processId?: number };
    console.log(
      `Queued chunk ${i / chunkSize + 1} (${chunk.length} contacts) — processId ${json.processId ?? "?"}`,
    );
  }
  console.log(`Submitted ${rows.length} contacts to Brevo in chunks of ${chunkSize}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
