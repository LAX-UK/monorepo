/**
 * Pass 1 — scan lots and write tmp/lot-artist-backfill-audit.csv
 * Run: `pnpm exec tsx src/scripts/backfill-lot-artist-id/pass-1-audit.ts` from apps/api (DATABASE_URL).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createDb } from "@auction/db";
import { analyzeLotArtistBackfill, loadAllLotsForBackfill } from "./scan.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }
  const db = createDb(url);
  const lots = await loadAllLotsForBackfill(db);
  const lines: string[] = [
    "lot_id,current_value,classification,suggested_artist_id,suggested_artist_name,ambiguity_count",
  ];
  for (const row of lots) {
    const r = await analyzeLotArtistBackfill(db, row);
    const cur = r.currentArtistId ?? "";
    lines.push(
      [
        r.lotId,
        escapeCsv(cur),
        r.classification,
        r.suggestedArtistId ?? "",
        escapeCsv(r.suggestedArtistName ?? ""),
        String(r.ambiguityCount),
      ].join(","),
    );
  }
  const outDir = join(__dirname, "..", "..", "..", "tmp");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "lot-artist-backfill-audit.csv");
  writeFileSync(outPath, lines.join("\n"), "utf8");
  console.log(`Wrote ${lines.length - 1} rows to ${outPath}`);
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
