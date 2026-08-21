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
  "external_accounts",
  "oauth_application",
  "oauth_access_token",
  "oauth_consent",
  /** `twoFactor` plugin backing table — required for `requestPasswordReset` / sign-in hooks on apps/api. */
  "two_factor",
] as const;
// apps/auth (auth_app) needs to enqueue email via IEmailService.enqueue() from the
// Better Auth send-verification-email / send-reset-password / databaseHooks.user.create.after
// hooks. That requires INSERT + SELECT on email_outbox, plus SELECT on email_suppression
// to honour suppression at enqueue time. Auth must NOT be able to update the outbox
// (that's the worker's job) or write to the suppression table (that's apps/api via the
// Postmark webhook and the unsubscribe route).
/** Tables `auth_app` may INSERT and SELECT (no UPDATE/DELETE).
 * - `email_outbox`: enqueue transactional mail from Better Auth hooks.
 * - `domain_events`: append `user.registered` (INSERT) and `user.email_verified`
 *   (`publishUserEmailVerified` SELECT pre-check + INSERT; see apps/auth). */
export const AUTH_INSERT_SELECT_TABLES = ["email_outbox", "domain_events"] as const;
export const AUTH_SELECT_TABLES = ["email_suppression"] as const;
const API_DENY_TABLES = [
  "session",
  "account",
  "verification",
  "jwks_key",
  "oauth_application",
  "oauth_access_token",
  "oauth_consent",
];
const API_READ_TABLES = ["user"];
const WORKER_READ_TABLES = [
  "user",
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
/** Columns `api_app` may UPDATE on `public.user` — must cover every `apps/api` write path
 * that uses `container.db`. Anything missing here surfaces as `permission denied for table user`.
 *
 * Intentionally denied to api_app (writes routed through `container.authDb` / `auth_app`):
 *   - `email`, `email_verified` — identity rewrite; only the dual-confirm email-change flow
 *     in `routes/auth.ts:confirm-email-change` may flip these, and it goes through authDb.
 *   - `two_factor_enabled` — managed by the Better Auth two-factor plugin.
 *   - `id`, `created_at` — never updatable from app code.
 */
export const API_COLUMN_UPDATE_GRANTS: Record<string, readonly string[]> = {
  user: [
    "first_name",
    "last_name",
    "mobile",
    "mobile_country",
    "signup_persona",
    "category_interests_onboarding_completed_at",
    "suspended_at",
    "suspended_reason",
    "updated_at",
  ],
};
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

type RoleName = "auth_app" | "api_app" | "worker_app";

const ROLE_PASSWORD_ENV: Record<RoleName, string> = {
  auth_app: "AUTH_APP_DB_PASSWORD",
  api_app: "API_APP_DB_PASSWORD",
  worker_app: "WORKER_APP_DB_PASSWORD",
};

function quoteIdent(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

async function tableExists(client: pg.Client, tableName: string): Promise<boolean> {
  const res = await client.query<{ exists: boolean }>(
    `select exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = $1
    )`,
    [tableName],
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
    | "INSERT, SELECT, UPDATE"
    | "INSERT, SELECT, UPDATE, DELETE"
    | "ALL PRIVILEGES",
): Promise<void> {
  if (!(await tableExists(client, tableName))) return;
  await client.query(
    `grant ${privileges} on table public.${quoteIdent(tableName)} to ${quoteIdent(role)}`,
  );
}

async function grantColumnUpdateIfExists(
  client: pg.Client,
  role: RoleName,
  tableName: string,
  columns: readonly string[],
): Promise<void> {
  if (!(await tableExists(client, tableName)) || columns.length === 0) return;
  const columnList = columns.map(quoteIdent).join(", ");
  await client.query(
    `grant update (${columnList}) on table public.${quoteIdent(tableName)} to ${quoteIdent(role)}`,
  );
}

async function revokeIfExists(
  client: pg.Client,
  role: RoleName,
  tableName: string,
  privileges = "ALL PRIVILEGES",
): Promise<void> {
  if (!(await tableExists(client, tableName))) return;
  await client.query(
    `revoke ${privileges} on table public.${quoteIdent(tableName)} from ${quoteIdent(role)}`,
  );
}

async function grantSequences(client: pg.Client, role: RoleName): Promise<void> {
  await client.query(
    `grant usage, select on all sequences in schema public to ${quoteIdent(role)}`,
  );
}

export async function applyApplicationRoleGrants(connectionString: string): Promise<void> {
  const client = new Client(buildPgConnectionConfig(connectionString));
  await client.connect();
  try {
    await client.query("begin");

    for (const role of ["auth_app", "api_app", "worker_app"] as const) {
      await ensureRole(client, role);
      await client.query(`grant usage on schema public to ${quoteIdent(role)}`);
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
    for (const tableName of AUTH_SELECT_TABLES) {
      await grantIfExists(client, "auth_app", tableName, "SELECT");
    }
    for (const tableName of tables) {
      if (API_DENY_TABLES.includes(tableName)) {
        await revokeIfExists(client, "api_app", tableName);
        continue;
      }
      if (API_READ_TABLES.includes(tableName)) {
        await grantIfExists(client, "api_app", tableName, "SELECT");
        await grantColumnUpdateIfExists(
          client,
          "api_app",
          tableName,
          API_COLUMN_UPDATE_GRANTS[tableName] ?? [],
        );
        continue;
      }
      await grantIfExists(client, "api_app", tableName, "ALL PRIVILEGES");
    }
    for (const tableName of WORKER_READ_TABLES) {
      await grantIfExists(client, "worker_app", tableName, "SELECT");
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

    for (const role of ["auth_app", "api_app", "worker_app"] as const) {
      await grantSequences(client, role);
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
