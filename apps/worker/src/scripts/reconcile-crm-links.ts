#!/usr/bin/env tsx
/** Compare active crm_record_link rows against Zoho (COQL id in (...)). */
import { createDb } from "@auction/db";
import { DrizzleCrmRecordLinkRepository } from "@auction/persistence/repositories";
import { loadWorkerEnv } from "../env.js";
import { CRM_ENTITY } from "../integrations/crm/crm-field-constants.js";
import { isRealZohoLink } from "../integrations/crm/crm-tombstone.js";
import { createZohoCrmGateway } from "../integrations/zoho/create-zoho-crm-gateway.js";

const COQL_BATCH = 50;

function escapeCoqlId(id: string): string {
  return id.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function main(): Promise<void> {
  const env = loadWorkerEnv();
  if (env.ZOHO_CRM_SYNC_MODE === "off") {
    console.error("ZOHO_CRM_SYNC_MODE=off — set live/canary/dry_run to query Zoho");
    process.exit(1);
  }

  const db = createDb(env.DATABASE_URL_WORKER ?? env.DATABASE_URL);
  const linkRepo = new DrizzleCrmRecordLinkRepository(db);
  const gateway = createZohoCrmGateway(env);

  for (const entityType of [CRM_ENTITY.subject, CRM_ENTITY.deal]) {
    let offset = 0;
    const limit = 200;
    for (;;) {
      const rows = await linkRepo.listActiveByEntityType(entityType, limit, offset);
      if (rows.length === 0) break;

      const byModule = new Map<string, typeof rows>();
      for (const row of rows) {
        if (!isRealZohoLink(row.zohoModule, row.zohoRecordId)) {
          console.log(JSON.stringify({ issue: "placeholder_link", row }));
          continue;
        }
        const list = byModule.get(row.zohoModule) ?? [];
        list.push(row);
        byModule.set(row.zohoModule, list);
      }

      for (const [module, moduleRows] of byModule) {
        for (let i = 0; i < moduleRows.length; i += COQL_BATCH) {
          const batch = moduleRows.slice(i, i + COQL_BATCH);
          const idList = batch.map((r) => `'${escapeCoqlId(r.zohoRecordId)}'`).join(",");
          const coql = `select id from ${module} where id in (${idList})`;
          const found = new Set(await gateway.executeCoql(coql));
          for (const row of batch) {
            if (!found.has(row.zohoRecordId)) {
              console.log(JSON.stringify({ issue: "missing_in_zoho", row }));
            } else {
              console.log(
                JSON.stringify({
                  ok: true,
                  entityId: row.entityId,
                  zohoRecordId: row.zohoRecordId,
                }),
              );
            }
          }
        }
      }

      offset += rows.length;
      if (rows.length < limit) break;
    }
  }

  for (const entityType of [CRM_ENTITY.subject, CRM_ENTITY.deal]) {
    let offset = 0;
    const limit = 200;
    for (;;) {
      const rows = await linkRepo.listErasedWithRealZohoLinks(entityType, limit, offset);
      if (rows.length === 0) break;

      const byModule = new Map<string, typeof rows>();
      for (const row of rows) {
        const list = byModule.get(row.zohoModule) ?? [];
        list.push(row);
        byModule.set(row.zohoModule, list);
      }

      for (const [module, moduleRows] of byModule) {
        for (let i = 0; i < moduleRows.length; i += COQL_BATCH) {
          const batch = moduleRows.slice(i, i + COQL_BATCH);
          const idList = batch.map((r) => `'${escapeCoqlId(r.zohoRecordId)}'`).join(",");
          const coql = `select id from ${module} where id in (${idList})`;
          const found = new Set(await gateway.executeCoql(coql));
          for (const row of batch) {
            if (found.has(row.zohoRecordId)) {
              console.log(JSON.stringify({ issue: "erased_locally_still_in_zoho", row }));
            }
          }
        }
      }

      offset += rows.length;
      if (rows.length < limit) break;
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
