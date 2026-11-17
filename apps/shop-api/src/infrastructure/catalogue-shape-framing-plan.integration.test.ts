import type { Database } from "@auction/db";
import { applyApplicationRoleGrants } from "@auction/db/migrate-roles";
import * as schema from "@auction/db/schema";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { NormalizedArtworkCatalogueFilters } from "../application/artwork-catalogue-filters.js";
import { createDrizzleArtworkCatalogueRepository } from "./drizzle-artwork-catalogue.repository.js";

const ownerUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const shopUrl = process.env.DATABASE_URL_SHOP;

/** Like the review's seed: about 3,000 works across 400 artists. */
const ARTISTS = 400;
const WORKS = Number(process.env.CATALOGUE_PLAN_WORKS ?? 3_000);
/**
 * Per query, far above what the semi-join plan takes (about 20 ms on a laptop) so a slow CI
 * runner does not fail it; the plan-shape check is what catches a regression at this size.
 */
const QUERY_TIME_LIMIT_MS = 1_000;

type PlanNode = {
  "Node Type": string;
  "Relation Name"?: string;
  "Join Filter"?: string;
  "Rows Removed by Join Filter"?: number;
  "Actual Loops"?: number;
  Plans?: PlanNode[];
};

function nodes(plan: PlanNode): PlanNode[] {
  return [plan, ...(plan.Plans ?? []).flatMap(nodes)];
}

const JOINED_TABLES = new Set(["shop_artist", "shop_party"]);

/**
 * The plan the scalar-subquery framing predicate produced: Postgres estimated one row for
 * `shop_artwork`, then joined the artist and party tables by nested loop, scanning them again
 * for every work and discarding the mismatches in a `Join Filter` (598,800 rows per query on
 * this seed). Read from the executed plan, so a nested loop the planner rightly picks for a
 * group with no works does not count.
 */
function quadraticJoins(plan: PlanNode): string[] {
  const problems: string[] = [];
  for (const node of nodes(plan)) {
    const relation = node["Relation Name"];
    const loops = node["Actual Loops"] ?? 0;
    if (node["Node Type"] === "Seq Scan" && relation && JOINED_TABLES.has(relation) && loops > 1) {
      problems.push(`Seq Scan on ${relation} ran ${loops} times`);
    }
    const removed = node["Rows Removed by Join Filter"] ?? 0;
    if (node["Node Type"] === "Nested Loop" && removed > WORKS) {
      problems.push(`Nested Loop removed ${removed} rows by ${node["Join Filter"]}`);
    }
  }
  return problems;
}

/**
 * Seeds a catalogue the size the review measured on, inside a transaction that is rolled back,
 * then runs the facet and list queries the repository sends through EXPLAIN ANALYZE. Fails if a
 * query goes back to the nested-loop plan or takes longer than a generous bound.
 */
describe.skipIf(!ownerUrl || !shopUrl)("catalogue orientation and framing query plans", () => {
  let ownerPool: pg.Pool;
  let client: pg.PoolClient;
  const captured: Array<{ sql: string; params: unknown[] }> = [];
  let db: Database;

  beforeAll(async () => {
    if (!ownerUrl) throw new Error("MIGRATION_TEST_DATABASE_URL is required");
    await applyApplicationRoleGrants(ownerUrl);
    ownerPool = new pg.Pool({ connectionString: ownerUrl });
    client = await ownerPool.connect();
    db = drizzle(client, {
      schema,
      logger: { logQuery: (sql, params) => captured.push({ sql, params }) },
    }) as unknown as Database;

    const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    await client.query("begin");
    await client.query(
      `with parties as (
         insert into shop_party (display_name)
         select 'Plan artist ' || n from generate_series(1, $2::int) n
         returning id, display_name
       )
       insert into shop_artist (party_id, slug)
       select id, 'plan-artist-' || $1 || '-' || replace(display_name, 'Plan artist ', '')
       from parties`,
      [suffix, ARTISTS],
    );
    // Mixed sizes (portrait, landscape and square, some unsized) and about three in four works
    // with a framing row, spread over the three modes.
    await client.query(
      `with artists as (
         select id, row_number() over (order by slug) as n
         from shop_artist where slug like 'plan-artist-' || $1 || '-%'
       )
       insert into shop_artwork
         (slug, title, artist_id, eligible_for_edition_allocation, import_key, published_at,
          height_cm, width_cm, print_price_pence, object_type, medium)
       select 'plan-work-' || $1 || '-' || w, 'Plan work ' || w, a.id, true,
              'plan:' || $1 || ':' || w, now(),
              case when w % 17 = 0 then null else 20 + (w * 7) % 110 end,
              20 + (w * 13) % 110,
              5000 + (w * 37) % 200000,
              (array['print', 'work_on_paper', 'photography', 'mixed_media'])[1 + w % 4]::shop_artwork_object_type,
              (array['Giclée print', 'Screenprint', 'Etching'])[1 + w % 3]
       from generate_series(1, $2::int) w
       join artists a on a.n = 1 + (w % $3::int)`,
      [suffix, WORKS, ARTISTS],
    );
    await client.query(
      `insert into shop_edition_framing (artwork_id, mode, framed_by_artist)
       select id,
              case n % 3 when 0 then 'unframed_or_framed' when 1 then 'framed_only' else 'framed_by_artist' end,
              case n % 3 when 2 then 'Black ash frame' end
       from (
         select id, row_number() over (order by slug) as n
         from shop_artwork where slug like 'plan-work-' || $1 || '-%'
       ) works
       where n % 4 <> 0`,
      [suffix],
    );
    const options = await client.query<{ id: string }>(
      `insert into shop_framing_option
         (code, name, frame, mount, glazing, hanging, lead_time_min_days, lead_time_max_days, status, sort_order)
       select 'plan-' || $1 || '-' || n, 'Plan frame ' || n, 'black_wood', 'window_conservation',
              'uv_acrylic', 'd_rings_cord', 5, 10, 'draft', 990 + n
       from generate_series(1, 2) n
       returning id`,
      [suffix],
    );
    for (const { id } of options.rows) {
      await client.query(
        `insert into shop_framing_option_price (option_id, band, price_pence, is_placeholder)
         values ($1, 'up_to_40x50', 9000, false), ($1, 'up_to_60x80', 12000, false),
                ($1, 'up_to_80x100', 15000, false)`,
        [id],
      );
      await client.query("update shop_framing_option set status = 'active' where id = $1", [id]);
      await client.query(
        `insert into shop_framing_edition_offer (option_id, artwork_id)
         select $1, f.artwork_id from shop_edition_framing f
         join shop_artwork a on a.id = f.artwork_id
         where a.slug like 'plan-work-' || $2 || '-%' and f.mode <> 'framed_by_artist'`,
        [id, suffix],
      );
    }
    await client.query(
      "analyze shop_party, shop_artist, shop_artwork, shop_edition_framing, shop_framing_edition_offer, shop_framing_option, shop_framing_option_price",
    );
  }, 60_000);

  afterAll(async () => {
    await client?.query("rollback");
    client?.release();
    await ownerPool?.end();
  });

  const cases: Array<{ name: string; filter: Partial<NormalizedArtworkCatalogueFilters> }> = [
    { name: "size=medium (baseline)", filter: { sizeBand: "medium" } },
    { name: "framing=unframed", filter: { framing: "unframed" } },
    { name: "framing=framed", filter: { framing: "framed" } },
    {
      name: "framing=framed&orientation=portrait&size=medium",
      filter: { framing: "framed", orientation: "portrait", sizeBand: "medium" },
    },
  ];

  for (const { name, filter } of cases) {
    it(`keeps the facet and list queries hashed and fast with ${name}`, async () => {
      const repository = createDrizzleArtworkCatalogueRepository(db);
      const full: NormalizedArtworkCatalogueFilters = {
        artworkType: "edition",
        sort: "newest",
        ...filter,
      };
      captured.length = 0;
      await repository.countFacets(full);
      await repository.listPublicArtworks({ limit: 24, filter: full });
      // Only the queries over the catalogue: the facet counts and the page itself.
      const queries = captured.filter((query) => /from "shop_artwork"/.test(query.sql));
      expect(queries.length).toBeGreaterThanOrEqual(10);

      const timings: number[] = [];
      const jit: number[] = [];
      for (const query of queries) {
        const result = await client.query<{
          "QUERY PLAN": [
            { Plan: PlanNode; "Execution Time": number; JIT?: { Timing: { Total: number } } },
          ];
        }>(`explain (analyze, format json) ${query.sql}`, query.params);
        const explained = result.rows[0]?.["QUERY PLAN"][0];
        if (!explained) throw new Error("EXPLAIN returned no plan");
        expect(quadraticJoins(explained.Plan), query.sql).toEqual([]);
        expect(explained["Execution Time"], query.sql).toBeLessThan(QUERY_TIME_LIMIT_MS);
        timings.push(explained["Execution Time"]);
        jit.push(explained.JIT?.Timing.Total ?? 0);
      }
      if (process.env.CATALOGUE_PLAN_REPORT) {
        console.info(
          `${name}: ${queries.length} queries, slowest ${Math.max(...timings).toFixed(1)} ms, ` +
            `slowest without JIT ${Math.max(...timings.map((t, i) => t - (jit[i] ?? 0))).toFixed(1)} ms`,
        );
      }
    }, 30_000);
  }
});
