import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { applyApplicationRoleGrants } from "@auction/db/migrate-roles";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDrizzleCrmShopEnquiryReader } from "./crm-shop-enquiry-reader.js";

const ownerUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const workerUrl = process.env.DATABASE_URL_WORKER;

/**
 * Runs the reader as `worker_app`, the role the CRM projector connects with. The Shop tables it
 * reads are denied to that role as a whole, so this fails if the column grants are missing.
 */
describe.skipIf(!ownerUrl || !workerUrl)("CRM Shop enquiry reader as worker_app", () => {
  const tag = randomUUID().slice(0, 8);
  const subjectId = `crm-enquiry-${tag}`;
  const artworkId = randomUUID();
  const partyId = randomUUID();
  const artistId = randomUUID();
  let owner: pg.Pool;

  beforeAll(async () => {
    if (!ownerUrl) throw new Error("MIGRATION_TEST_DATABASE_URL is required");
    owner = new pg.Pool({ connectionString: ownerUrl });
    await applyApplicationRoleGrants(ownerUrl);
    await owner.query("insert into shop_party (id, display_name) values ($1, $2)", [
      partyId,
      `Artist ${tag}`,
    ]);
    await owner.query("insert into shop_artist (id, party_id, slug) values ($1, $2, $3)", [
      artistId,
      partyId,
      `crm-artist-${tag}`,
    ]);
    await owner.query(
      `insert into shop_artwork (id, slug, title, artist_id, eligible_for_edition_allocation, import_key)
       values ($1, $2, 'Blue Study', $3, false, $4)`,
      [artworkId, `blue-study-${tag}`, artistId, `crm-enquiry:${tag}`],
    );
    await owner.query(
      `insert into shop_artwork_interest (artwork_id, identity_subject_id, intent, reference, contact_phone)
       values ($1, $2, 'enquiry', $3, '+447700900123')`,
      [artworkId, subjectId, `E-${tag}`],
    );
    await owner.query(
      `insert into bid_identity_directory (subject_id, email, name, identity_created_at)
       values ($1, $2, 'Ann Directory', now())`,
      [subjectId, `ann.directory.${tag}@integration.test`],
    );
    await owner.query(
      `insert into shop_user_profile (identity_subject_id, email, name) values ($1, $2, 'Ann Profile')`,
      [subjectId, `ann.profile.${tag}@integration.test`],
    );
  });

  afterAll(async () => {
    if (!owner) return;
    await owner.query("delete from shop_user_profile where identity_subject_id = $1", [subjectId]);
    await owner.query("delete from bid_identity_directory where subject_id = $1", [subjectId]);
    await owner.query("delete from shop_artwork where id = $1", [artworkId]);
    await owner.query("delete from shop_artist where id = $1", [artistId]);
    await owner.query("delete from shop_party where id = $1", [partyId]);
    await owner.end();
  });

  it("reads the enquiry, the work and the sender, preferring the identity directory email", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
    const reader = createDrizzleCrmShopEnquiryReader(createDb(workerUrl!));
    expect(await reader.find({ artworkId, subjectId })).toEqual({
      email: `ann.directory.${tag}@integration.test`,
      name: "Ann Directory",
      phone: "+447700900123",
      reference: `E-${tag}`,
      artworkTitle: "Blue Study",
      artworkSlug: `blue-study-${tag}`,
      stockCode: null,
    });
  });

  it("falls back to the Shop profile when the directory has no row", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
    const reader = createDrizzleCrmShopEnquiryReader(createDb(workerUrl!));
    await owner.query("delete from bid_identity_directory where subject_id = $1", [subjectId]);
    expect(await reader.find({ artworkId, subjectId })).toMatchObject({
      email: `ann.profile.${tag}@integration.test`,
      name: "Ann Profile",
    });
  });

  it("returns null for a work that is gone", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
    const reader = createDrizzleCrmShopEnquiryReader(createDb(workerUrl!));
    expect(await reader.find({ artworkId: randomUUID(), subjectId })).toBeNull();
  });
});
