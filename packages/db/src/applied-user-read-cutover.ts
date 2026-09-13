import pg from "pg";
import { PRODUCTION_MIGRATION_CEILING_BY_TAG } from "./production-migration-ceiling.js";
import { buildPgConnectionConfig } from "./ssl.js";

export type UserReadCutoverHead = "none" | "0159" | "0160" | "0161";

export type UserReadCutover = {
  lastAppliedFolderMillis: number | null;
  head: UserReadCutoverHead;
  workerUserSelectRevoked: boolean;
  apiUserSelectRevoked: boolean;
};

type Queryable = Pick<pg.Client, "query">;

export function describeUserReadCutover(lastAppliedFolderMillis: number | null): UserReadCutover {
  const workerUserSelectRevoked =
    lastAppliedFolderMillis != null &&
    lastAppliedFolderMillis >= PRODUCTION_MIGRATION_CEILING_BY_TAG["0160"].folderMillis;
  const apiUserSelectRevoked =
    lastAppliedFolderMillis != null &&
    lastAppliedFolderMillis >= PRODUCTION_MIGRATION_CEILING_BY_TAG["0161"].folderMillis;
  let head: UserReadCutoverHead = "none";
  if (apiUserSelectRevoked) head = "0161";
  else if (workerUserSelectRevoked) head = "0160";
  else if (lastAppliedFolderMillis != null) head = "0159";
  return {
    lastAppliedFolderMillis,
    head,
    workerUserSelectRevoked,
    apiUserSelectRevoked,
  };
}

export async function readLastAppliedFolderMillis(client: Queryable): Promise<number | null> {
  try {
    const result = await client.query<{ created_at: string | number | null }>(
      `select created_at
         from drizzle.__drizzle_migrations
        order by created_at desc
        limit 1`,
    );
    const value = result.rows[0]?.created_at;
    return value == null ? null : Number(value);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "42P01" || code === "3F000") return null;
    throw error;
  }
}

export async function readUserReadCutover(client: Queryable): Promise<UserReadCutover> {
  return describeUserReadCutover(await readLastAppliedFolderMillis(client));
}

export async function readUserReadCutoverFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): Promise<UserReadCutover> {
  const url = env.DATABASE_URL_OWNER ?? env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL_OWNER or DATABASE_URL is required to read the user-read cutover");
  }
  const client = new pg.Client(buildPgConnectionConfig(url));
  await client.connect();
  try {
    return await readUserReadCutover(client);
  } finally {
    await client.end();
  }
}

export function formatUserReadCutover(cutover: UserReadCutover): string {
  return [
    `identity_user_read_cutover head=${cutover.head}`,
    `last_applied=${cutover.lastAppliedFolderMillis ?? "none"}`,
    `worker_user_select=${cutover.workerUserSelectRevoked ? "revoked" : "soak"}`,
    `api_user_select=${cutover.apiUserSelectRevoked ? "revoked" : "soak"}`,
  ].join(" ");
}
