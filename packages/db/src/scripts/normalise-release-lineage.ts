#!/usr/bin/env node
/**
 * Normalise production's migration ledger from the release lineage before main's first
 * production migrate. Dry run by default; `--apply` writes.
 *
 *   DATABASE_URL_OWNER=... pnpm db:normalise-release-lineage --release-head=<sha>
 *   DATABASE_URL_OWNER=... pnpm db:normalise-release-lineage --release-head=<sha> --apply
 *
 * `--release-head` is the release commit production runs; it must be the approved head in
 * `release-lineage-mapping.ts`. See docs/engineering/release-main-parity.md.
 */
import pg from "pg";
import { readJournalMigrations } from "../migrate-runner.js";
import { PgReleaseLineageUnitOfWork } from "../release-lineage-archive.js";
import { RELEASE_LINEAGE_BASELINE } from "../release-lineage-mapping.js";
import {
  type NormalisationReport,
  normaliseReleaseLineage,
} from "../release-lineage-normaliser.js";
import { buildPgConnectionConfig } from "../ssl.js";

function readReleaseHead(argv: readonly string[]): string {
  const flag = argv.find((arg) => arg.startsWith("--release-head="));
  const value = flag?.slice("--release-head=".length).trim();
  if (!value) {
    throw new Error("--release-head=<sha> is required: the release commit production runs");
  }
  return value;
}

function formatReport(report: NormalisationReport): string[] {
  const lines = [`Release head ${report.releaseHead} (approved).`];
  if (report.plan.status === "already-normalised") {
    lines.push(
      `Already normalised: the archive holds the approved release rows and the ledger holds ${report.plan.mainRowsAboveBaseline} main rows after ${RELEASE_LINEAGE_BASELINE.tag}. Nothing to do.`,
    );
    return lines;
  }
  lines.push(
    `${report.wrote ? "Archived" : "Will archive"} ${report.plan.rows.length} release rows; the ledger then ends at ${RELEASE_LINEAGE_BASELINE.tag}:`,
  );
  for (const { ledgerId, row } of report.plan.rows) {
    const next =
      row.disposition.kind === "adopt"
        ? `main ${row.disposition.mainTag} is recorded without executing`
        : "archive only";
    lines.push(
      `  ${row.releaseWhen} ${row.releaseTag} ${row.sha256} (ledger id ${ledgerId}): ${next}`,
    );
  }
  if (!report.wrote) {
    lines.push("Dry run: nothing was written. Re-run with --apply to archive these rows.");
  }
  return lines;
}

async function main() {
  const releaseHead = readReleaseHead(process.argv);
  const mode = process.argv.includes("--apply") ? "apply" : "dry-run";
  const url = process.env.DATABASE_URL_OWNER;
  if (!url) throw new Error("DATABASE_URL_OWNER is required");

  const client = new pg.Client(buildPgConnectionConfig(url));
  await client.connect();
  try {
    const report = await normaliseReleaseLineage({
      unitOfWork: new PgReleaseLineageUnitOfWork(client),
      journal: readJournalMigrations(),
      releaseHead,
      mode,
    });
    for (const line of formatReport(report)) console.log(line);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
