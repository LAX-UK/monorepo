#!/usr/bin/env tsx
/**
 * Backfill CRM Leads for existing identity directory rows (respects ZOHO_CRM_SYNC_MODE).
 * Use --dry-run to log actions without HTTP. Live writes require sync mode live/canary.
 */
import { createDb } from "@auction/db";
import { bidIdentityDirectory } from "@auction/db/schema";
import { DrizzleCrmRecordLinkRepository } from "@auction/persistence/repositories";
import { and, asc, isNull } from "drizzle-orm";
import { loadWorkerEnv } from "../env.js";
import { mapDomainEventToCrmIntent } from "../integrations/crm/crm-event-mappers.js";
import { CRM_ENTITY, CRM_FIELD } from "../integrations/crm/crm-field-constants.js";
import { isRealZohoLink } from "../integrations/crm/crm-tombstone.js";
import { createZohoCrmGateway } from "../integrations/zoho/create-zoho-crm-gateway.js";
import { resolveZohoDeliveryMode } from "../integrations/zoho/zoho-crm-config.js";

const BATCH = 100;
const SLEEP_MS = 1_500;

function parseArgs(argv: string[]): { dryRun: boolean } {
  return { dryRun: argv.includes("--dry-run") };
}

function mapperContextFromEnv(env: ReturnType<typeof loadWorkerEnv>) {
  return {
    auctionPipeline: env.ZOHO_CRM_AUCTION_PIPELINE,
    dealStageLotWon: env.ZOHO_CRM_DEAL_STAGE_LOT_WON,
    dealStagePaymentCaptured: env.ZOHO_CRM_DEAL_STAGE_PAYMENT_CAPTURED,
    dealStagePaymentRefunded: env.ZOHO_CRM_DEAL_STAGE_PAYMENT_REFUNDED,
    dealStageShopPaid: env.ZOHO_CRM_DEAL_STAGE_SHOP_PAID,
    attribution: null,
  };
}

async function shouldSkipSubject(
  linkRepo: DrizzleCrmRecordLinkRepository,
  subjectId: string,
): Promise<{ skip: true; reason: string } | { skip: false }> {
  if (await linkRepo.isErased(CRM_ENTITY.subject, subjectId)) {
    return { skip: true, reason: "subject_erased" };
  }
  if (await linkRepo.isDeletionRequested(CRM_ENTITY.subject, subjectId)) {
    return { skip: true, reason: "deletion_requested" };
  }
  const link = await linkRepo.findByEntity(CRM_ENTITY.subject, subjectId);
  if (link && !link.erasedAt && isRealZohoLink(link.zohoModule, link.zohoRecordId)) {
    return { skip: true, reason: "already_linked" };
  }
  return { skip: false };
}

async function main(): Promise<void> {
  const { dryRun } = parseArgs(process.argv.slice(2));
  const env = loadWorkerEnv();
  const mode = env.ZOHO_CRM_SYNC_MODE;
  const performHttp = !dryRun && (mode === "live" || mode === "canary");

  const db = createDb(env.DATABASE_URL_WORKER ?? env.DATABASE_URL);
  const linkRepo = new DrizzleCrmRecordLinkRepository(db);
  const gateway = createZohoCrmGateway(env);
  const mapperContext = mapperContextFromEnv(env);

  let offset = 0;
  for (;;) {
    const rows = await db
      .select({
        id: bidIdentityDirectory.subjectId,
        email: bidIdentityDirectory.email,
        name: bidIdentityDirectory.name,
      })
      .from(bidIdentityDirectory)
      .where(
        and(
          isNull(bidIdentityDirectory.deletionRequestedAt),
          isNull(bidIdentityDirectory.mergedIntoSubjectId),
        ),
      )
      .orderBy(asc(bidIdentityDirectory.subjectId))
      .limit(BATCH)
      .offset(offset);
    if (rows.length === 0) break;

    const eligible: typeof rows = [];
    for (const row of rows) {
      const skip = await shouldSkipSubject(linkRepo, row.id);
      if (skip.skip) {
        console.log(JSON.stringify({ userId: row.id, skipped: skip.reason, dryRun }));
        continue;
      }
      eligible.push(row);
    }

    if (!performHttp) {
      for (const row of eligible) {
        const intent = mapDomainEventToCrmIntent(
          {
            id: 0,
            eventType: "user.registered",
            aggregateId: row.id,
            schemaVersion: 1,
            payload: {
              userId: row.id,
              email: row.email,
              name: row.name ?? row.email,
              source: "backfill",
            },
          },
          mapperContext,
        );
        console.log(
          JSON.stringify({
            userId: row.id,
            action: dryRun ? "dry_run_would_upsert" : "no_http_mode",
            intent: intent.kind,
            mode,
          }),
        );
      }
      offset += rows.length;
      await new Promise((r) => setTimeout(r, SLEEP_MS));
      continue;
    }

    const deliveryMode = resolveZohoDeliveryMode(env, "user.registered");
    if (deliveryMode !== "live" && deliveryMode !== "canary") {
      console.log(
        JSON.stringify({ skipped: "user.registered_not_enabled", batch: eligible.length }),
      );
      offset += rows.length;
      continue;
    }

    const toUpsert: typeof eligible = [];
    for (const row of eligible) {
      const email = row.email?.trim() ?? "";
      if (email.length > 0) {
        const contactMatch = await gateway.findByEmail({ module: "Contacts", email });
        const leadMatch = contactMatch ?? (await gateway.findByEmail({ module: "Leads", email }));
        if (leadMatch) {
          await linkRepo.upsertLink({
            entityType: CRM_ENTITY.subject,
            entityId: row.id,
            zohoModule: leadMatch.module,
            zohoRecordId: leadMatch.recordId,
          });
          console.log(
            JSON.stringify({
              userId: row.id,
              outcome: "linked_existing_zoho",
              module: leadMatch.module,
            }),
          );
          continue;
        }
      }
      toUpsert.push(row);
    }

    const records = toUpsert.map((row) => {
      const intent = mapDomainEventToCrmIntent(
        {
          id: 0,
          eventType: "user.registered",
          aggregateId: row.id,
          schemaVersion: 1,
          payload: {
            userId: row.id,
            email: row.email,
            name: row.name ?? row.email,
            source: "backfill",
          },
        },
        mapperContext,
      );
      if (intent.kind !== "person_upsert") {
        throw new Error(`unexpected_intent:${intent.kind}`);
      }
      return intent.fields as Record<string, string | number | boolean | null>;
    });

    if (records.length === 0) {
      offset += rows.length;
      continue;
    }

    const results = await gateway.upsertMany({
      module: "Leads",
      records,
      duplicateCheckFields: [CRM_FIELD.subjectExternalId, "Email"],
    });

    for (let i = 0; i < toUpsert.length; i += 1) {
      const row = toUpsert[i];
      const result = results[i];
      if (row && result?.status === "success" && result.recordId) {
        await linkRepo.upsertLink({
          entityType: CRM_ENTITY.subject,
          entityId: row.id,
          zohoModule: "Leads",
          zohoRecordId: result.recordId,
        });
      }
      console.log(
        JSON.stringify({
          userId: row?.id,
          outcome: result?.status ?? "missing_result",
          code: result?.code,
        }),
      );
    }

    offset += rows.length;
    await new Promise((r) => setTimeout(r, SLEEP_MS));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
