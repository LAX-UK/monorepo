import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { artistProfile } from "@auction/db/schema";
import { createDrizzleArtistProfileRepository } from "@auction/persistence/repositories";
import { describe, expect, it } from "vitest";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)(
  "DrizzleArtistProfileRepository.listPublicDirectory facets (integration)",
  () => {
    it("computeDirectoryFacets does not reference a missing bucket column", async () => {
      // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
      const db = createDb(process.env.DATABASE_URL!);
      const rollback = new Error("rollback_test_tx");
      const suffix = randomUUID().slice(0, 8);

      try {
        await db.transaction(async (tx) => {
          const repo = createDrizzleArtistProfileRepository(tx);
          const t = new Date();
          await tx.insert(artistProfile).values([
            {
              displayName: "Alice Artist",
              slug: `p-facet-alice-${suffix}`,
              status: "approved",
              kind: "artist",
              birthYear: "1895",
              createdAt: t,
              updatedAt: t,
            },
            {
              displayName: "9 Lives",
              slug: `p-facet-nine-${suffix}`,
              status: "approved",
              kind: "maker",
              birthYear: "2001",
              createdAt: t,
              updatedAt: t,
            },
          ]);

          const result = await repo.listPublicDirectory({
            limit: 10,
            offset: 0,
            sort: "name_asc",
          });

          expect(result.total).toBeGreaterThanOrEqual(2);
          expect(result.facets.letters.length).toBeGreaterThan(0);
          expect(result.facets.topDecades.length).toBeGreaterThan(0);

          throw rollback;
        });
      } catch (e) {
        if (e !== rollback) throw e;
      }
    });
  },
);
