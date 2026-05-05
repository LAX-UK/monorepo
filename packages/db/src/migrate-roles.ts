import pg from "pg";
import { buildPgConnectionConfig } from "./ssl.js";

const { Client } = pg;

const AUTH_FULL_TABLES = [
  "user",
  "session",
  "account",
  "verification",
  "jwks_key",
  "external_accounts",
  "oauth_application",
  "oauth_access_token",
  "oauth_consent",
];
// apps/auth (auth_app) needs to enqueue email via IEmailService.enqueue() from the
// Better Auth send-verification-email / send-reset-password / databaseHooks.user.create.after
// hooks. That requires INSERT + SELECT on email_outbox, plus SELECT on email_suppression
// to honour suppression at enqueue time. Auth must NOT be able to update the outbox
// (that's the worker's job) or write to the suppression table (that's apps/api via the
// Postmark webhook and the unsubscribe route).
const AUTH_INSERT_SELECT_TABLES = ["email_outbox"];
const AUTH_SELECT_TABLES = ["email_suppression"];
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
const WORKER_READ_TABLES = ["user"];
// API profile endpoints may update only these Better Auth user columns. Keep this
// narrower than table-level UPDATE so api_app cannot mutate auth/security fields.
const API_COLUMN_UPDATE_GRANTS: Record<string, readonly string[]> = {
  user: ["name", "image", "updated_at"],
};
// Postgres requires UPDATE on the target table for `select ... for update` row locks even
// when no rows are mutated. The projector runner pulls events with FOR UPDATE SKIP LOCKED,
// so worker_app needs SELECT + UPDATE on these tables. Keep them out of WORKER_FULL_TABLES
// to deny INSERT/DELETE/TRUNCATE on the append-only event log.
//
// email_outbox and newsletter_signup_log are also SELECT+UPDATE: the worker drains rows
// inserted by apps/auth/apps/api but must not insert new ones (callers do that) and must
// not delete (the rows are part of the audit trail for delivery and Postmaster review).
const WORKER_LOCK_READ_TABLES = ["domain_events", "email_outbox", "newsletter_signup_log"];
const WORKER_FULL_TABLES = ["projector_state", "webhook_event", "upload_object"];

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
  privileges: "SELECT" | "SELECT, UPDATE" | "INSERT, SELECT" | "ALL PRIVILEGES",
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
      await grantIfExists(client, "auth_app", tableName, "ALL PRIVILEGES");
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
    for (const tableName of WORKER_FULL_TABLES) {
      await grantIfExists(client, "worker_app", tableName, "ALL PRIVILEGES");
    }

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
