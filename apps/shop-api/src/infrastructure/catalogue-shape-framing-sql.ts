import {
  shopArtwork,
  shopEditionFraming,
  shopFramingEditionOffer,
  shopFramingOption,
  shopFramingOptionPrice,
} from "@auction/db/schema";
import {
  CATALOGUE_FRAMING_RULES,
  CATALOGUE_SQUARE_TOLERANCE_PERCENT,
  type CatalogueFramingKey,
  type CatalogueOrientationKey,
} from "@auction/shop-domain";
import { type SQL, or, sql } from "drizzle-orm";

/**
 * `catalogueOrientationFor` from `@auction/shop-domain` as SQL, for the catalogue filter and its
 * counts. The comparison is exact (`numeric`), as the domain's is in whole hundredths of a
 * centimetre. Works without both a positive height and width match no orientation.
 */
export function inCatalogueOrientationSql(key: CatalogueOrientationKey): SQL {
  const height = sql`${shopArtwork.heightCm}`;
  const width = sql`${shopArtwork.widthCm}`;
  const ratio = 100 + CATALOGUE_SQUARE_TOLERANCE_PERCENT;
  const known = sql`${height} > 0 AND ${width} > 0`;
  const portrait = sql`${height} * 100 > ${width} * ${sql.raw(String(ratio))}`;
  const landscape = sql`${width} * 100 > ${height} * ${sql.raw(String(ratio))}`;
  switch (key) {
    case "portrait":
      return sql`(${known} AND ${portrait})`;
    case "landscape":
      return sql`(${known} AND ${landscape})`;
    case "square":
      return sql`(${known} AND NOT (${portrait}) AND NOT (${landscape}))`;
  }
}

/**
 * The framing tests are semi-joins (`exists` / `not exists`) on `shop_edition_framing`, never a
 * scalar subquery that reads the mode: Postgres cannot estimate a scalar subquery's selectivity,
 * guesses one row for `shop_artwork`, and then joins the artist and party tables by nested loop,
 * which grows with works × artists. A semi-join is estimated from the table's statistics and
 * keeps the outer joins hashed. `catalogue-shape-framing-plan.integration.test.ts` guards this.
 */
const hasNoFramingRowSql = sql`not exists (
  select 1 from ${shopEditionFraming}
  where ${shopEditionFraming.artworkId} = ${shopArtwork.id}
)`;

/**
 * The edition offers at least one option buyers can see: `isBuyerOffered` from
 * `@auction/shop-domain`, an active option with no placeholder price.
 */
const offersVisibleFramingSql = sql`exists (
  select 1 from ${shopFramingEditionOffer}
  inner join ${shopFramingOption} on ${shopFramingOption.id} = ${shopFramingEditionOffer.optionId}
  where ${shopFramingEditionOffer.artworkId} = ${shopArtwork.id}
    and ${shopFramingOption.status} = 'active'
    and not exists (
      select 1 from ${shopFramingOptionPrice}
      where ${shopFramingOptionPrice.optionId} = ${shopFramingOption.id}
        and ${shopFramingOptionPrice.isPlaceholder}
    )
)`;

/** The edition has a framing row in one of these modes. */
function hasFramingModeSql(modes: readonly string[]): SQL {
  return sql`exists (
    select 1 from ${shopEditionFraming}
    where ${shopEditionFraming.artworkId} = ${shopArtwork.id}
      and ${shopEditionFraming.mode} in (${sql.join(
        modes.map((mode) => sql`${mode}`),
        sql`, `,
      )})
  )`;
}

/**
 * `isInCatalogueFraming` from `@auction/shop-domain` as SQL, built from the same rules, so the
 * filter and its counts hold exactly the editions the domain names.
 */
export function inCatalogueFramingSql(key: CatalogueFramingKey): SQL {
  const rule = CATALOGUE_FRAMING_RULES[key];
  const parts: SQL[] = [];
  if (rule.withoutFramingRow) parts.push(hasNoFramingRowSql);
  if (rule.modes.length > 0) parts.push(hasFramingModeSql(rule.modes));
  if (rule.modesWithOfferedOption.length > 0) {
    parts.push(
      sql`(${hasFramingModeSql(rule.modesWithOfferedOption)} and ${offersVisibleFramingSql})`,
    );
  }
  return parts.length > 0 ? sql`(${or(...parts) as SQL})` : sql`false`;
}
