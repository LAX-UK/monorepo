import type { Database } from "@auction/db";
import { shopArtwork, shopEditionFacts } from "@auction/db/schema";
import {
  type EditionFacts,
  type PublicEditionFacts,
  type PublicSetApart,
  ShopDomainError,
  publicEditionAvailability,
  publicEditionRun,
} from "@auction/shop-domain";
import { and, eq, inArray, or } from "drizzle-orm";
import type { ArtworkEditionReadModel } from "../application/read-models/catalogue.read-model.js";
import { publicArtworkVisible } from "./artwork-visibility-sql.js";
import { factsFromColumns } from "./edition-facts-columns.js";
import { proofsKeptFromColumns, runFromColumns } from "./edition-run-columns.js";
import { editionCountsByArtworkId } from "./public-artwork-rows.js";
import { type ResolvedSetApart, resolveSetApartListings } from "./set-apart-source.js";

type ArtworkRow = typeof shopArtwork.$inferSelect;
type FactsRow = typeof shopEditionFacts.$inferSelect;

/**
 * Facts for a storefront: who confirmed them stays inside, and so does the staff note on why a
 * numbered run's certificate is not numbered to match.
 */
function publicFacts(row: FactsRow | undefined): PublicEditionFacts | null {
  return row ? publicFactsOf(factsFromColumns(row)) : null;
}

function publicFactsOf(facts: EditionFacts): PublicEditionFacts {
  const { certificate } = facts;
  return {
    numbering: facts.numbering,
    signature: facts.signature,
    certificate:
      certificate.kind === "included"
        ? {
            kind: "included",
            issuer: certificate.issuer,
            form: certificate.form,
            arrives: certificate.arrives,
            numberedToMatch: certificate.numberedToMatch,
            // Shoppers learn who gave the authority; the date and the letter stay with staff.
            ...(certificate.authority
              ? { authority: { givenBy: certificate.authority.givenBy } }
              : {}),
          }
        : { kind: "none" },
    ...(facts.stamp && facts.stamp !== "none" ? { stamp: facts.stamp } : {}),
    ...(facts.printedBy ? { printedBy: facts.printedBy } : {}),
    ...(facts.publishedBy ? { publishedBy: facts.publishedBy } : {}),
  };
}

function publicSetApart(resolved: ResolvedSetApart): PublicSetApart {
  return { print: resolved.print, exception: resolved.exception };
}

/**
 * The run behind an artwork, its confirmed facts and the other runs of the same image that are
 * on the storefront. Null for an original, or when the stored run is not valid: a page then falls
 * back to what it knew before.
 */
export async function loadPublicEdition(
  db: Database,
  artworkId: string,
): Promise<ArtworkEditionReadModel | null> {
  const [self] = await db.select().from(shopArtwork).where(eq(shopArtwork.id, artworkId)).limit(1);
  if (!self || self.runKind === null) return null;
  const rootId = self.mainRunArtworkId ?? self.id;
  const rows = await db
    .select()
    .from(shopArtwork)
    .where(
      or(
        eq(shopArtwork.id, rootId),
        and(eq(shopArtwork.mainRunArtworkId, rootId), publicArtworkVisible()),
      ),
    );
  return buildEdition(db, self, rows);
}

async function buildEdition(
  db: Database,
  self: ArtworkRow,
  related: readonly ArtworkRow[],
): Promise<ArtworkEditionReadModel | null> {
  const root = related.find((row) => row.id === (self.mainRunArtworkId ?? self.id));
  const mainKept = root ? proofsKeptFromColumns(root) : null;
  const others = related.filter((row) => row.id !== self.id && row.runKind !== null);
  const ids = [self.id, ...others.map((row) => row.id)];
  const apart = await resolveSetApartListings(db, [self, ...others]);
  const [factsRows, counts] = await Promise.all([
    db.select().from(shopEditionFacts).where(inArray(shopEditionFacts.artworkId, ids)),
    editionCountsByArtworkId(
      db,
      others.map((row) => row.id),
    ),
  ]);
  const factsById = new Map(factsRows.map((row) => [row.artworkId, row]));
  try {
    const ownApart = apart.get(self.id);
    if (self.runRole === "set_apart" && !ownApart) return null;
    const run = ownApart
      ? { spec: ownApart.run, proofsKept: ownApart.proofsKept }
      : runFromColumns(self, mainKept);
    if (!run) return null;
    const otherRuns: ArtworkEditionReadModel["otherRuns"] = [];
    for (const row of others) {
      // The main run is read for its proofs even if unlisted; only listed runs are offered.
      if (!row.publishedAt || row.archivedAt) continue;
      try {
        const otherApart = apart.get(row.id);
        if (row.runRole === "set_apart" && !otherApart) continue;
        const other = otherApart ? { spec: otherApart.run } : runFromColumns(row, mainKept);
        if (!other) continue;
        const rowCounts = counts.get(row.id) ?? { total: 0, available: 0 };
        otherRuns.push({
          slug: row.slug,
          run: publicEditionRun(other.spec),
          facts: otherApart?.facts
            ? publicFactsOf(otherApart.facts)
            : publicFacts(factsById.get(row.id)),
          ...(otherApart ? { setApart: publicSetApart(otherApart) } : {}),
          printPricePence: row.printPricePence,
          availability:
            row.saleState === "sold"
              ? "sold_out"
              : publicEditionAvailability({
                  eligibleForEditionAllocation: row.eligibleForEditionAllocation,
                  totalEditionCount: rowCounts.total,
                  availableEditionCount: rowCounts.available,
                }).state,
        });
      } catch (error) {
        if (!(error instanceof ShopDomainError)) throw error;
      }
    }
    const isProof = run.spec.type === "proof";
    const ownKept = ownApart?.proofsKept ?? mainKept ?? proofsKeptFromColumns(self);
    return {
      run: publicEditionRun(run.spec),
      facts: ownApart
        ? ownApart.facts
          ? publicFactsOf(ownApart.facts)
          : null
        : publicFacts(factsById.get(self.id)),
      proofsKept: isProof || ownApart ? null : { ap: ownKept.ap, pp: ownKept.pp, hc: ownKept.hc },
      otherRuns,
      ...(ownApart ? { setApart: publicSetApart(ownApart), runTitle: ownApart.runTitle } : {}),
    };
  } catch (error) {
    if (error instanceof ShopDomainError) return null;
    throw error;
  }
}
