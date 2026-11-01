/** Storage keys of the pictures the catalogue shows, for jobs that need to visit every one. */
import {
  artistProfile,
  bidIdentityDirectory,
  category,
  type createDb,
  itemSubmission,
  lot,
  mediaAsset,
  sale,
} from "@auction/db";
import { sql } from "drizzle-orm";

export function normalizeCatalogueKey(value: string, publicBaseUrl?: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return null;

  if (publicBaseUrl) {
    const prefix = `${publicBaseUrl.replace(/\/$/, "")}/`;
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length)).replace(/^\/+/, "");
    }
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return null;
  }

  return trimmed.replace(/^\/+/, "");
}

export async function listCatalogueImageKeys(
  db: ReturnType<typeof createDb>,
  opts: { force: boolean; limit?: number },
): Promise<string[]> {
  const limitSql = opts.limit ? sql`limit ${opts.limit}` : sql``;
  const missingOnlySql = opts.force
    ? sql``
    : sql`and not exists (select 1 from ${mediaAsset} ma where ma.key = refs.key)`;

  const result = await db.execute<{ key: string }>(sql`
    select distinct refs.key as key
    from (
      select unnest(${lot.images}) as key from ${lot} where cardinality(${lot.images}) > 0
      union
      select unnest(${sale.coverImages}) as key from ${sale} where cardinality(${sale.coverImages}) > 0
      union
      select slot.value ->> 'key' as key from ${sale}, jsonb_each(${sale.coverSlots}) as slot
      where slot.value ->> 'key' is not null
      union
      select slot.value -> 'fromLot' ->> 'imageKey' as key from ${sale}, jsonb_each(${sale.coverSlots}) as slot
      where slot.value -> 'fromLot' ->> 'imageKey' is not null
      union
      select unnest(${itemSubmission.images}) as key from ${itemSubmission} where cardinality(${itemSubmission.images}) > 0
      union
      select ${category.heroImageKey} as key from ${category} where ${category.heroImageKey} is not null
      union
      select ${artistProfile.portraitUrl} as key from ${artistProfile} where ${artistProfile.portraitUrl} is not null
      union
      select ${artistProfile.heroImageUrl} as key from ${artistProfile} where ${artistProfile.heroImageUrl} is not null
      union
      select ${bidIdentityDirectory.image} as key
      from ${bidIdentityDirectory}
      where ${bidIdentityDirectory.image} is not null
    ) refs
    where refs.key is not null and trim(refs.key) <> ''
    ${missingOnlySql}
    order by refs.key
    ${limitSql}
  `);

  return result.rows.map((row) => row.key);
}
