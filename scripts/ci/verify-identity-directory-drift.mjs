#!/usr/bin/env node
/**
 * Reconciles the product-local Identity directory against the shared-cluster
 * Identity source before worker_app's direct user-table grant is revoked.
 *
 * Run against an owner connection:
 *   DATABASE_URL_OWNER=... node scripts/ci/verify-identity-directory-drift.mjs
 */
import pg from "pg";

const { Client } = pg;
const connectionString = process.env.DATABASE_URL_OWNER ?? process.env.DATABASE_URL;
const maxProcessingLagMs = Number(process.env.IDENTITY_DIRECTORY_MAX_PROCESSING_LAG_MS ?? 60_000);

if (!connectionString) {
  throw new Error("DATABASE_URL_OWNER or DATABASE_URL is required");
}
if (!Number.isFinite(maxProcessingLagMs) || maxProcessingLagMs < 0) {
  throw new Error("IDENTITY_DIRECTORY_MAX_PROCESSING_LAG_MS must be a non-negative number");
}

const client = new Client({ connectionString });

try {
  await client.connect();

  const { rows } = await client.query(`
    WITH source_user AS (
      SELECT *
      FROM public."user"
      WHERE email <> 'deleted+' || id || '@purged.invalid'
    ),
    canonical_source AS (
      SELECT * FROM source_user WHERE merged_into_subject_id IS NULL
    ),
    canonical_directory AS (
      SELECT * FROM public.bid_identity_directory WHERE merged_into_subject_id IS NULL
    )
    SELECT
      count(*) FILTER (WHERE d.subject_id IS NULL)::int AS missing_rows,
      count(*) FILTER (WHERE u.id IS NULL)::int AS orphan_rows,
      count(*) FILTER (
        WHERE u.id IS NOT NULL
          AND d.subject_id IS NOT NULL
          AND (
            d.email IS DISTINCT FROM u.email
            OR d.name IS DISTINCT FROM u.name
            OR d.image IS DISTINCT FROM u.image
            OR d.phone IS DISTINCT FROM u.phone_number
            OR d.email_verified IS DISTINCT FROM u.email_verified
            OR d.deletion_requested_at IS DISTINCT FROM u.deletion_requested_at
            OR d.identity_created_at IS DISTINCT FROM u.created_at
          )
      )::int AS mismatched_rows,
      (
        SELECT count(*)::int
        FROM source_user retired
        LEFT JOIN canonical_directory canonical
          ON canonical.subject_id = retired.merged_into_subject_id
        LEFT JOIN public.bid_identity_directory alias
          ON alias.subject_id = retired.id
        WHERE retired.merged_into_subject_id IS NOT NULL
          AND (
            canonical.subject_id IS NULL
            OR alias.subject_id IS NULL
            OR alias.merged_into_subject_id IS DISTINCT FROM retired.merged_into_subject_id
            OR alias.email IS DISTINCT FROM canonical.email
            OR alias.name IS DISTINCT FROM canonical.name
            OR alias.image IS DISTINCT FROM canonical.image
            OR alias.phone IS DISTINCT FROM canonical.phone
          )
      ) AS invalid_alias_rows
    FROM canonical_source u
    FULL OUTER JOIN canonical_directory d ON d.subject_id = u.id
  `);

  const { rows: projectorRows } = await client.query(
    `
      WITH cursor AS (
        SELECT last_processed_event_id
        FROM public.projector_state
        WHERE projector_name = 'bid_identity_directory'
      )
      SELECT
        (SELECT count(*)::int FROM cursor) AS cursor_rows,
        (
          SELECT count(e.id)::int
          FROM public.domain_events e
          CROSS JOIN cursor c
          WHERE e.id > c.last_processed_event_id
            AND e.event_type = ANY($1::text[])
        ) AS pending_events,
        (
          SELECT COALESCE(
            max(extract(epoch FROM (d.replicated_at - e.occurred_at)) * 1000),
            0
          )::float8
          FROM public.bid_identity_directory d
          JOIN public.domain_events e ON e.id = d.last_event_id
        ) AS max_processing_lag_ms
    `,
    [
      [
        "user.registered",
        "user.profile_updated",
        "user.email_verified",
        "user.deletion_requested",
        "user.deletion_cancelled",
        "user.identity_merged",
        "user.identity_deleted",
      ],
    ],
  );

  const source = rows[0] ?? {};
  const projector = projectorRows[0] ?? {};
  const missing = Number(source.missing_rows ?? 0);
  const orphan = Number(source.orphan_rows ?? 0);
  const mismatched = Number(source.mismatched_rows ?? 0);
  const invalidAliases = Number(source.invalid_alias_rows ?? 0);
  const cursorRows = Number(projector.cursor_rows ?? 0);
  const pending = Number(projector.pending_events ?? 0);
  const processingLagMs = Number(projector.max_processing_lag_ms ?? 0);

  console.log(
    [
      "identity directory reconciliation:",
      `missing=${missing}`,
      `orphan=${orphan}`,
      `mismatched=${mismatched}`,
      `invalid_alias=${invalidAliases}`,
      `cursor_rows=${cursorRows}`,
      `pending_events=${pending}`,
      `max_processing_lag_ms=${Math.round(processingLagMs)}`,
    ].join(" "),
  );

  if (
    missing > 0 ||
    orphan > 0 ||
    mismatched > 0 ||
    invalidAliases > 0 ||
    cursorRows !== 1 ||
    pending > 0 ||
    processingLagMs > maxProcessingLagMs
  ) {
    process.exitCode = 1;
  }
} finally {
  await client.end();
}
