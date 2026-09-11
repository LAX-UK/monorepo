/** Session-scoped singleton lock for auth at-rest maintenance. */
export const AUTH_AT_REST_BACKFILL_LOCK_KEY = 0x61757468_6174_7265n;

export async function tryAcquireAuthAtRestLock(client: {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<{ acquired: boolean }> }>;
}): Promise<boolean> {
  const result = await client.query("select pg_try_advisory_lock($1::bigint) as acquired", [
    AUTH_AT_REST_BACKFILL_LOCK_KEY.toString(),
  ]);
  return result.rows[0]?.acquired === true;
}

export async function releaseAuthAtRestLock(client: {
  query: (sql: string, params?: unknown[]) => Promise<unknown>;
}): Promise<void> {
  await client.query("select pg_advisory_unlock($1::bigint)", [
    AUTH_AT_REST_BACKFILL_LOCK_KEY.toString(),
  ]);
}
