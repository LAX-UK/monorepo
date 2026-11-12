import type { XeroTokenSealer } from "./sealing.js";

export type XeroTokenQueryable = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
};

export type XeroTokenBackfillResult = {
  /** Rows sealed and their plaintext nulled by this run. */
  sealed: number;
  /** Rows a concurrent token refresh changed mid-run; the next run picks them up. */
  skipped: number;
};

const PENDING_WHERE = "(access_token is not null or refresh_token is not null)";

type Row = {
  id: string;
  access_token: string | null;
  refresh_token: string | null;
  access_token_sealed: string | null;
  refresh_token_sealed: string | null;
};

/** Rows that still hold a token in the clear. */
export async function countPlaintextXeroTokens(db: XeroTokenQueryable): Promise<number> {
  const { rows } = await db.query(
    `select count(*)::int as n from xero_connection where ${PENDING_WHERE}`,
  );
  return Number(rows[0]?.n ?? 0);
}

/** Throws unless no connection holds a plaintext token and every sealed one opens. */
export async function verifyXeroTokensSealed(
  db: XeroTokenQueryable,
  sealer: XeroTokenSealer,
): Promise<void> {
  if ((await countPlaintextXeroTokens(db)) > 0) throw new Error("xero_token_plaintext_remaining");
  const { rows } = await db.query(
    `select id, access_token, refresh_token, access_token_sealed, refresh_token_sealed
       from xero_connection`,
  );
  for (const row of rows as Row[]) sealer.open(toStored(row));
}

/**
 * Seals every connection that still holds a plaintext token, then nulls the plaintext, in one
 * statement per row. Idempotent: a sealed row is not selected again. The update only applies if
 * the row is unchanged since it was read, so a concurrent token refresh is never overwritten with
 * an older token. A plaintext value, being the newer write, wins over a stale sealed one.
 */
export async function backfillXeroTokenSealing(
  db: XeroTokenQueryable,
  sealer: XeroTokenSealer,
): Promise<XeroTokenBackfillResult> {
  const { rows } = await db.query(
    `select id, access_token, refresh_token, access_token_sealed, refresh_token_sealed
       from xero_connection where ${PENDING_WHERE} order by id`,
  );
  const result: XeroTokenBackfillResult = { sealed: 0, skipped: 0 };
  for (const row of rows as Row[]) {
    const tokens = sealer.open({
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      accessTokenSealed: row.access_token === null ? row.access_token_sealed : null,
      refreshTokenSealed: row.refresh_token === null ? row.refresh_token_sealed : null,
    });
    const columns = sealer.seal(tokens);
    const check = sealer.open({ ...columns });
    if (check.accessToken !== tokens.accessToken || check.refreshToken !== tokens.refreshToken) {
      throw new Error("xero_token_seal_roundtrip_mismatch");
    }
    const updated = await db.query(
      `update xero_connection
          set access_token = null, refresh_token = null,
              access_token_sealed = $2, refresh_token_sealed = $3
        where id = $1
          and access_token is not distinct from $4
          and refresh_token is not distinct from $5
          and access_token_sealed is not distinct from $6
          and refresh_token_sealed is not distinct from $7
        returning id`,
      [
        row.id,
        columns.accessTokenSealed,
        columns.refreshTokenSealed,
        row.access_token,
        row.refresh_token,
        row.access_token_sealed,
        row.refresh_token_sealed,
      ],
    );
    if (updated.rows.length === 1) result.sealed += 1;
    else result.skipped += 1;
  }
  return result;
}

function toStored(row: Row) {
  return {
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    accessTokenSealed: row.access_token_sealed,
    refreshTokenSealed: row.refresh_token_sealed,
  };
}
