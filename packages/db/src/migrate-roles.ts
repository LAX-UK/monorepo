import pg from "pg";
import { buildPgSslConfig } from "./ssl.js";

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
const WORKER_READ_TABLES = ["domain_events", "user"];
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
  privileges: "SELECT" | "ALL PRIVILEGES",
): Promise<void> {
  if (!(await tableExists(client, tableName))) return;
  await client.query(
    `grant ${privileges} on table public.${quoteIdent(tableName)} to ${quoteIdent(role)}`,
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
  const client = new Client({ connectionString, ssl: buildPgSslConfig() });
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
    for (const tableName of tables) {
      if (API_DENY_TABLES.includes(tableName)) {
        await revokeIfExists(client, "api_app", tableName);
        continue;
      }
      if (API_READ_TABLES.includes(tableName)) {
        await grantIfExists(client, "api_app", tableName, "SELECT");
        continue;
      }
      await grantIfExists(client, "api_app", tableName, "ALL PRIVILEGES");
    }
    for (const tableName of WORKER_READ_TABLES) {
      await grantIfExists(client, "worker_app", tableName, "SELECT");
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
