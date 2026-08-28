import pg from "pg";
import { buildPgConnectionConfig } from "./ssl.js";

const { Client } = pg;

/** Tables Better Auth runs as `auth_app` must have CRUD DML on (never TRUNCATE/REFERENCES/TRIGGER). */
export const AUTH_FULL_TABLES = [
  "user",
  "session",
  "account",
  "verification",
  "jwks_key",
  "oauth_application",
  "oauth_access_token",
  "oauth_consent",
  "oidc_rp_session",
  "oidc_backchannel_logout_delivery",
  "ssf_stream",
  "ssf_delivery",
  /** `twoFactor` plugin backing table used only by the canonical auth issuer. */
  "two_factor",
] as const;
/** Append-only Identity side effects emitted by apps/auth. */
export const AUTH_INSERT_SELECT_TABLES = ["identity_lifecycle_outbox"] as const;
export const AUTH_DENY_TABLES = [
  "email_outbox",
  "email_suppression",
  "external_accounts",
  "bid_identity_directory",
  "bid_user_profile",
] as const;
export const API_DENY_TABLES = [
  "user",
  "session",
  "account",
  "verification",
  "two_factor",
  "jwks_key",
  "oauth_application",
  "oauth_access_token",
  "oauth_consent",
  "oidc_rp_session",
  "oidc_backchannel_logout_delivery",
  "shop_user_profile",
  "shop_identity_session",
  "shop_logout_token_replay",
  "ssf_stream",
  "ssf_delivery",
  "identity_lifecycle_outbox",
  "shop_ssf_replay",
] as const;
/** Identity-backed read models exposed to the Bid API without write privileges. */
export const API_READ_TABLES = ["bid_identity_directory"] as const;
/** Product-local profile tables owned by apps/api (Bid). */
export const API_PRODUCT_PROFILE_TABLES = ["bid_user_profile"] as const;
export const API_SSF_RECEIVER_TABLES = ["bid_ssf_replay"] as const;
/** Shop Identity owns only its local Identity projection. */
export const SHOP_PRODUCT_PROFILE_TABLES = [
  "shop_user_profile",
  "shop_identity_session",
  "shop_logout_token_replay",
] as const;
export const SHOP_SSF_RECEIVER_TABLES = ["shop_ssf_replay"] as const;
/** Worker projectors upsert Shop/Bid local projections from Identity domain events. */
export const WORKER_PRODUCT_PROFILE_TABLES = [
  "shop_user_profile",
  "bid_user_profile",
  "bid_identity_directory",
] as const;
/** Tables whose DML must remain unavailable to worker_app. */
export const WORKER_DENY_TABLES = [
  ...AUTH_FULL_TABLES,
  ...API_SSF_RECEIVER_TABLES,
  "shop_identity_session",
  "shop_logout_token_replay",
  ...SHOP_SSF_RECEIVER_TABLES,
] as const;
export const WORKER_READ_TABLES = [
  /** Identity lifecycle outbox relay reads pending rows before inserting into domain_events. */
  "identity_lifecycle_outbox",
  /** Catalogue tables scanned by backfill-media-assets (read image key columns only). */
  "sale",
  "item_submission",
  "category",
  "artist_profile",
  /** Legal Entity Model - worker needs SELECT for projectors */
  "legal_entity",
  "legal_entity_member",
  "legal_entity_payout_method",
  "kyc_verification",
  "artist_alias",
  "admin_review_task",
  /** SoF projectors read case status / exposure for emails and retention job. */
  "source_of_funds",
];
// Postgres requires UPDATE on the target table for `select ... for update` row locks even
// when no rows are mutated. The projector runner pulls events with FOR UPDATE SKIP LOCKED,
// so worker_app needs SELECT + UPDATE on these tables. Keep them out of WORKER_FULL_TABLES
// to deny INSERT/DELETE/TRUNCATE on the append-only event log.
//
// newsletter_signup_log is SELECT+UPDATE: the worker drains rows inserted by apps/api
// but must not insert new ones (apps/api does that) and must not delete (audit trail).
// email_outbox is handled separately below because the worker also enqueues mail from its
// own projectors (notification-fanout, payout-transfer-failed-notify) via
// PostmarkEmailService.enqueue(), which performs an INSERT on idempotency miss.
const WORKER_LOCK_READ_TABLES = [
  "domain_events",
  "newsletter_signup_log",
  /** archive cascade updates bids + draft/scheduled lots. */
  "bid",
  "lot",
  /** Sale lifecycle reconciliation updates umbrella sale status. */
  "sale",
];

/** Bulk payout settlement creates payout + line rows and updates payout transfer state. */
export const WORKER_PAYOUT_SETTLEMENT_TABLES = ["payout", "payout_line"] as const;

/** Stripe Connect readiness sync during settlement updates cached flags + lifecycle status. */
export const WORKER_LEGAL_ENTITY_CONNECT_SETTLEMENT_COLUMNS = [
  "status",
  "stripe_connect_charges_enabled",
  "stripe_connect_payouts_enabled",
  "stripe_connect_requirements_currently_due",
  "stripe_connect_requirements_errors",
  "stripe_connect_disabled_reason",
  "updated_at",
] as const;
export const WORKER_FULL_TABLES = [
  "projector_state",
  "webhook_event",
  "upload_object",
  /** process-image job upserts; image-cleanup deletes rows. */
  "media_asset",
  "marketing_click_ids",
  "marketing_attribution",
] as const;
/** Worker persists async QR scan events (qr-code-scan job via persistQrCodeScan). */
export const WORKER_QR_CODE_SCAN_TABLES = ["qr_code_scan", "qr_code_scan_daily"] as const;
/** Worker provisions personal legal entities from `user.registered` domain events. */
export const WORKER_PROVISIONING_TABLES = ["legal_entity", "legal_entity_member"] as const;
/** Worker processes async CSV exports and purges expired rows (data-export + purge-expired jobs). */
export const WORKER_DATA_EXPORT_TABLES = ["data_exports"] as const;

/** Per-consumer delivery ledger (Zoho/Xero projector leases, retry, dead-letter). */
export const WORKER_DOMAIN_EVENT_DELIVERY_TABLES = ["domain_event_delivery"] as const;

/** Worker-local finance cron: expire stale pending/authorized payments. */
export const WORKER_PAYMENT_MAINTENANCE_TABLES = ["payment"] as const;

/** Worker-local finance cron: Xero OAuth, external refs, webhook replay, refund reconcile. */
export const WORKER_FINANCE_INTEGRATION_TABLES = [
  "xero_connection",
  "payment_external_ref",
  "xero_webhook_event",
  "payment_refund_reconcile",
] as const;

/** Display pairing hygiene cron (expire pending + purge terminal rows). */
export const WORKER_DISPLAY_PAIRING_TABLES = ["saleroom_display_pairing"] as const;

/** Invoice addressing reads during lot invoice initiation. */
export const WORKER_FINANCE_READ_TABLES = ["address"] as const;

/** Lot lifecycle notification staging (won/lost) drained by notification outbox cron. */
export const WORKER_NOTIFICATION_OUTBOX_TABLES = ["notification_outbox"] as const;

/** Watchlist reads for lifecycle starting / ending-soon notifications. */
export const WORKER_LIFECYCLE_READ_TABLES = ["watchlist", "saleroom_session"] as const;

/** Worker lifecycle journal upserts during activate/end/bid early-close. */
export const WORKER_LIFECYCLE_SNAPSHOT_TABLES = ["lot_lifecycle_snapshot"] as const;

/** DLQ exhaustion audit rows when worker consumes BullMQ queues. */
export const WORKER_FAILED_JOBS_TABLES = ["failed_jobs"] as const;

/** Worker-local absentee replay and bid placement for lifecycle activation. */
export const WORKER_ABSENTEE_BID_TABLES = ["absentee_bid"] as const;

/** Worker absentee replay inserts bids during activation replay. */
export const WORKER_BID_PLACEMENT_TABLES = ["bid"] as const;

type RoleName = "auth_app" | "api_app" | "shop_app" | "worker_app";

const ROLE_PASSWORD_ENV: Record<RoleName, string> = {
  auth_app: "AUTH_APP_DB_PASSWORD",
  api_app: "API_APP_DB_PASSWORD",
  shop_app: "SHOP_APP_DB_PASSWORD",
  worker_app: "WORKER_APP_DB_PASSWORD",
};

function quoteIdent(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

async function tableExists(
  client: pg.Client,
  tableName: string,
  schemaName = "public",
): Promise<boolean> {
  const res = await client.query<{ exists: boolean }>(
    `select exists (
      select 1 from information_schema.tables
      where table_schema = $1 and table_name = $2
    )`,
    [schemaName, tableName],
  );
  return Boolean(res.rows[0]?.exists);
}

async function existingPublicTables(client: pg.Client): Promise<string[]> {
  const res = await client.query<{ table_name: string }>(
    `select table_name
     from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'
     order by table_name`,
  );
  return res.rows.map((row) => row.table_name);
}

async function hasTablePrivilege(
  client: pg.Client,
  role: RoleName,
  tableName: string,
  privilege: "SELECT",
  schemaName = "public",
): Promise<boolean> {
  if (!(await tableExists(client, tableName, schemaName))) return false;
  const res = await client.query<{ allowed: boolean }>(
    "select has_table_privilege($1, $2, $3) as allowed",
    [role, `${quoteIdent(schemaName)}.${quoteIdent(tableName)}`, privilege],
  );
  return Boolean(res.rows[0]?.allowed);
}

async function ensureRole(client: pg.Client, role: RoleName): Promise<void> {
  const password = process.env[ROLE_PASSWORD_ENV[role]];
  const exists = await client.query<{ exists: boolean }>(
    "select exists (select 1 from pg_roles where rolname = $1)",
    [role],
  );
  if (!exists.rows[0]?.exists) {
    const passwordSql = password ? ` password ${quoteLiteral(password)}` : "";
    await client.query(`create role ${quoteIdent(role)} login${passwordSql}`);
  } else if (password) {
    await client.query(
      `alter role ${quoteIdent(role)} with login password ${quoteLiteral(password)}`,
    );
  } else {
    await client.query(`alter role ${quoteIdent(role)} with login`);
  }
}

async function grantIfExists(
  client: pg.Client,
  role: RoleName,
  tableName: string,
  privileges:
    | "SELECT"
    | "SELECT, UPDATE"
    | "SELECT, UPDATE, DELETE"
    | "INSERT"
    | "INSERT, SELECT"
    | "INSERT, SELECT, DELETE"
    | "INSERT, SELECT, UPDATE"
    | "INSERT, SELECT, UPDATE, DELETE"
    | "ALL PRIVILEGES",
  schemaName = "public",
): Promise<void> {
  if (!(await tableExists(client, tableName, schemaName))) return;
  await client.query(
    `grant ${privileges} on table ${quoteIdent(schemaName)}.${quoteIdent(tableName)} to ${quoteIdent(role)}`,
  );
}

async function grantColumnUpdateIfExists(
  client: pg.Client,
  role: RoleName,
  tableName: string,
  columns: readonly string[],
  schemaName = "public",
): Promise<void> {
  if (!(await tableExists(client, tableName, schemaName)) || columns.length === 0) return;
  const columnList = columns.map(quoteIdent).join(", ");
  await client.query(
    `grant update (${columnList}) on table ${quoteIdent(schemaName)}.${quoteIdent(tableName)} to ${quoteIdent(role)}`,
  );
}

async function revokeIfExists(
  client: pg.Client,
  role: RoleName,
  tableName: string,
  privileges = "ALL PRIVILEGES",
  schemaName = "public",
): Promise<void> {
  if (!(await tableExists(client, tableName, schemaName))) return;
  await client.query(
    `revoke ${privileges} on table ${quoteIdent(schemaName)}.${quoteIdent(tableName)} from ${quoteIdent(role)}`,
  );
}

async function grantSequences(
  client: pg.Client,
  role: RoleName,
  schemaName: string,
): Promise<void> {
  await client.query(
    `grant usage, select on all sequences in schema ${quoteIdent(schemaName)} to ${quoteIdent(role)}`,
  );
}

export async function applyApplicationRoleGrants(connectionString: string): Promise<void> {
  const client = new Client(buildPgConnectionConfig(connectionString));
  await client.connect();
  try {
    await client.query("begin");

    const roles = ["auth_app", "api_app", "shop_app", "worker_app"] as const;
    for (const role of roles) {
      await ensureRole(client, role);
      await client.query(`grant usage on schema public to ${quoteIdent(role)}`);
    }

    // public.user is migration-controlled for worker_app and api_app. Preserve
    // each soak grant across this script's global reset, but do not recreate it
    // after migration 0160 or 0161 respectively has revoked it.
    const restoreWorkerUserSelect = await hasTablePrivilege(client, "worker_app", "user", "SELECT");
    const restoreApiUserSelect = await hasTablePrivilege(client, "api_app", "user", "SELECT");

    for (const role of roles) {
      await client.query(
        `revoke all privileges on all tables in schema public from ${quoteIdent(role)}`,
      );
    }

    const tables = await existingPublicTables(client);

    for (const tableName of AUTH_FULL_TABLES) {
      await grantIfExists(client, "auth_app", tableName, "INSERT, SELECT, UPDATE, DELETE");
    }
    for (const tableName of AUTH_INSERT_SELECT_TABLES) {
      await grantIfExists(client, "auth_app", tableName, "INSERT, SELECT");
    }
    for (const tableName of tables) {
      if ((API_DENY_TABLES as readonly string[]).includes(tableName)) {
        await revokeIfExists(client, "api_app", tableName);
        continue;
      }
      if ((API_READ_TABLES as readonly string[]).includes(tableName)) {
        continue;
      }
      if ((API_PRODUCT_PROFILE_TABLES as readonly string[]).includes(tableName)) {
        await grantIfExists(client, "api_app", tableName, "INSERT, SELECT, UPDATE");
        continue;
      }
      if ((API_SSF_RECEIVER_TABLES as readonly string[]).includes(tableName)) {
        await grantIfExists(client, "api_app", tableName, "INSERT, SELECT, DELETE");
        continue;
      }
      await grantIfExists(client, "api_app", tableName, "ALL PRIVILEGES");
    }
    for (const tableName of WORKER_READ_TABLES) {
      await grantIfExists(client, "worker_app", tableName, "SELECT");
    }
    for (const tableName of SHOP_PRODUCT_PROFILE_TABLES) {
      await grantIfExists(
        client,
        "shop_app",
        tableName,
        tableName === "shop_user_profile"
          ? "INSERT, SELECT, UPDATE"
          : "INSERT, SELECT, UPDATE, DELETE",
      );
    }
    for (const tableName of SHOP_SSF_RECEIVER_TABLES) {
      await grantIfExists(client, "shop_app", tableName, "INSERT, SELECT, DELETE");
    }
    for (const tableName of WORKER_LOCK_READ_TABLES) {
      await grantIfExists(client, "worker_app", tableName, "SELECT, UPDATE");
    }
    /** worker jobs append domain_events (archive cascade, impersonation sweeper). */
    await grantIfExists(client, "worker_app", "domain_events", "INSERT");
    /** AML / SoF projectors insert and resolve MLRO review work items (admin_review_task). */
    await grantIfExists(client, "worker_app", "admin_review_task", "INSERT, SELECT, UPDATE");
    /** SoF documents projector inserts buyer in-app notifications (documents requested / closure). */
    await grantIfExists(client, "worker_app", "notification", "INSERT, SELECT");
    /** Retention job anonymizes buyer-supplied SoF evidence after AML window. */
    await grantIfExists(client, "worker_app", "source_of_funds_document", "SELECT, UPDATE");
    /** worker send-email reads suppression list and inserts manual suppressions for missing users. */
    await grantIfExists(client, "worker_app", "email_suppression", "INSERT, SELECT");
    /** worker enqueues mail from notification-fanout projectors (INSERT) and the send-email
     * job updates rows to sent/failed/sending (SELECT, UPDATE). DELETE remains denied so the
     * outbox stays an immutable audit trail of attempted delivery. */
    await grantIfExists(client, "worker_app", "email_outbox", "INSERT, SELECT, UPDATE");
    /** worker drains marketing_event_outbox (Meta CAPI + sGTM publisher) — INSERT for skipped
     * audit rows, SELECT + UPDATE for poller, DELETE for retention purge of terminal rows only. */
    await grantIfExists(
      client,
      "worker_app",
      "marketing_event_outbox",
      "INSERT, SELECT, UPDATE, DELETE",
    );
    /** worker writes one audit row per marketing-contact-sync attempt (Brevo). INSERT + SELECT
     * only; rows are an immutable audit trail (no UPDATE/DELETE from app code). */
    await grantIfExists(client, "worker_app", "marketing_contact_sync_log", "INSERT, SELECT");
    for (const tableName of WORKER_DATA_EXPORT_TABLES) {
      await grantIfExists(client, "worker_app", tableName, "SELECT, UPDATE, DELETE");
    }
    for (const tableName of WORKER_PRODUCT_PROFILE_TABLES) {
      await grantIfExists(
        client,
        "worker_app",
        tableName,
        tableName === "bid_identity_directory"
          ? "INSERT, SELECT, UPDATE, DELETE"
          : "INSERT, SELECT, UPDATE",
      );
    }
    for (const tableName of WORKER_FULL_TABLES) {
      await grantIfExists(client, "worker_app", tableName, "ALL PRIVILEGES");
    }
    for (const tableName of WORKER_PROVISIONING_TABLES) {
      await grantIfExists(client, "worker_app", tableName, "INSERT, SELECT");
    }
    /** FK target when inserting scan rows. */
    await grantIfExists(client, "worker_app", "qr_code", "SELECT");
    for (const tableName of WORKER_QR_CODE_SCAN_TABLES) {
      await grantIfExists(client, "worker_app", tableName, "INSERT, SELECT, UPDATE");
    }
    for (const tableName of WORKER_DOMAIN_EVENT_DELIVERY_TABLES) {
      await grantIfExists(client, "worker_app", tableName, "INSERT, SELECT, UPDATE");
    }
    for (const tableName of WORKER_PAYMENT_MAINTENANCE_TABLES) {
      await grantIfExists(client, "worker_app", tableName, "SELECT, UPDATE");
    }
    for (const tableName of WORKER_FINANCE_INTEGRATION_TABLES) {
      await grantIfExists(client, "worker_app", tableName, "INSERT, SELECT, UPDATE");
    }
    for (const tableName of WORKER_DISPLAY_PAIRING_TABLES) {
      await grantIfExists(client, "worker_app", tableName, "SELECT, UPDATE, DELETE");
    }
    for (const tableName of WORKER_FINANCE_READ_TABLES) {
      await grantIfExists(client, "worker_app", tableName, "SELECT");
    }
    for (const tableName of WORKER_NOTIFICATION_OUTBOX_TABLES) {
      await grantIfExists(client, "worker_app", tableName, "INSERT, SELECT, UPDATE");
    }
    for (const tableName of WORKER_LIFECYCLE_READ_TABLES) {
      await grantIfExists(client, "worker_app", tableName, "SELECT");
    }
    for (const tableName of WORKER_LIFECYCLE_SNAPSHOT_TABLES) {
      await grantIfExists(client, "worker_app", tableName, "INSERT, SELECT, UPDATE");
    }
    for (const tableName of WORKER_FAILED_JOBS_TABLES) {
      await grantIfExists(client, "worker_app", tableName, "INSERT, SELECT, UPDATE");
    }
    for (const tableName of WORKER_ABSENTEE_BID_TABLES) {
      await grantIfExists(client, "worker_app", tableName, "SELECT, UPDATE");
    }
    for (const tableName of WORKER_BID_PLACEMENT_TABLES) {
      await grantIfExists(client, "worker_app", tableName, "INSERT, SELECT, UPDATE");
    }
    for (const tableName of WORKER_PAYOUT_SETTLEMENT_TABLES) {
      await grantIfExists(client, "worker_app", tableName, "INSERT, SELECT, UPDATE");
    }
    await grantColumnUpdateIfExists(
      client,
      "worker_app",
      "legal_entity",
      WORKER_LEGAL_ENTITY_CONNECT_SETTLEMENT_COLUMNS,
    );

    for (const tableName of API_READ_TABLES) {
      await grantIfExists(client, "api_app", tableName, "SELECT");
    }
    if (restoreWorkerUserSelect) {
      await grantIfExists(client, "worker_app", "user", "SELECT");
    }
    if (restoreApiUserSelect) {
      await grantIfExists(client, "api_app", "user", "SELECT");
    }

    for (const role of ["auth_app", "api_app", "worker_app"] as const) {
      await grantSequences(client, role, "public");
    }

    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    await client.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.DATABASE_URL_OWNER;
  if (!url) {
    throw new Error("DATABASE_URL_OWNER is required to apply application role grants");
  }
  applyApplicationRoleGrants(url)
    .then(() => {
      console.log("Application role grants applied.");
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
