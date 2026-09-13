#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  APPROVED_RELEASE_HEAD,
  RELEASE_TO_MAIN_SQL_MAPPING,
  assertApprovedReleaseHead,
} from "../release-lineage-mapping.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../drizzle");
const apply = process.argv.includes("--apply");

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function verifyRenumberedSqlParity(): void {
  for (const mapping of RELEASE_TO_MAIN_SQL_MAPPING) {
    const mainPath = join(root, `${mapping.mainTag}.sql`);
    const mainHash = sha256(mainPath);
    if (mainHash !== mapping.sha256) {
      throw new Error(
        `Main SQL ${mapping.mainTag} hash ${mainHash} does not match approved release mapping for ${mapping.releaseTag}`,
      );
    }
  }
}

async function main() {
  const releaseHead = process.env.RELEASE_HEAD_SHA ?? APPROVED_RELEASE_HEAD;
  assertApprovedReleaseHead(releaseHead);
  verifyRenumberedSqlParity();
  console.log(`Verified release lineage mapping for ${releaseHead}.`);

  if (!apply) {
    console.log(
      "Dry run only. Re-run with --apply on a disposable database to adopt main lineage.",
    );
    return;
  }

  const { default: pg } = await import("pg");
  const url = process.env.DATABASE_URL_OWNER;
  if (!url) throw new Error("DATABASE_URL_OWNER is required for --apply");

  const pool = new pg.Pool({ connectionString: url });
  try {
    const { runMigrationsPerTransactionThrough } = await import("../migrate-runner.js");
    const journal = JSON.parse(readFileSync(join(root, "meta/_journal.json"), "utf8"));
    const target = journal.entries.find(
      (entry: { tag: string }) => entry.tag === "0161_revoke_api_user_reads",
    );
    if (!target) throw new Error("Main journal missing 0161_revoke_api_user_reads");
    await runMigrationsPerTransactionThrough(pool, target.when);
    console.log("Applied main migrations through 0161 on disposable database.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
