import type { Database } from "@auction/db";
import { itemSubmission, lot, sale, user } from "@auction/db";
import { sql } from "drizzle-orm";
import type pino from "pino";
import type { UploadStorage } from "../lib/upload-storage.js";

export async function cleanupImageJob(args: {
  db: Database;
  storage: UploadStorage;
  key: string;
  publicBaseUrl?: string | undefined;
  log: pino.Logger;
}): Promise<void> {
  const key = args.key.trim().replace(/^\/+/, "");
  if (!key) return;

  if (await isImageKeyReferenced(args.db, key, referenceValues(key, args.publicBaseUrl))) {
    args.log.info({ key }, "skipped image cleanup because key is still referenced");
    return;
  }

  await args.storage.deleteObject(key);
  args.log.info({ key }, "deleted unreferenced image object");
}

async function isImageKeyReferenced(
  db: Database,
  key: string,
  values: readonly string[],
): Promise<boolean> {
  const refs = sql`array[${sql.join(
    values.map((value) => sql`${value}`),
    sql`, `,
  )}]::text[]`;
  const result = await db.execute<{ referenced: boolean }>(sql`
    select exists (
        select 1 from ${user} where ${user.image} = any(${values})
        union all
        select 1 from ${lot} where ${lot.images} && ${refs}
        union all
        select 1 from ${sale} where ${sale.coverImages} && ${refs}
        union all
        select 1 from ${itemSubmission} where ${itemSubmission.images} && ${refs}
      ) as "referenced"
  `);
  const row = result.rows[0];
  return Boolean(row?.referenced);
}

function referenceValues(key: string, publicBaseUrl: string | undefined): string[] {
  const values = [key];
  if (publicBaseUrl) {
    values.push(`${publicBaseUrl.replace(/\/$/, "")}/${key}`);
  }
  return values;
}
