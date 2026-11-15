import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { applyApplicationRoleGrants } from "@auction/db/migrate-roles";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDrizzleOrderFulfilmentFactsReader } from "./drizzle-order-fulfilment-facts.reader.js";

const ownerUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const workerUrl = process.env.DATABASE_URL_WORKER;

/**
 * Runs the reader as `worker_app`, the role the fulfilment mirror connects with. The Shop tables it
 * reads are denied to that role as a whole, so this fails if the column grants are missing.
 */
describe.skipIf(!ownerUrl || !workerUrl)("order fulfilment facts reader as worker_app", () => {
  const tag = randomUUID().slice(0, 8);
  const partyId = randomUUID();
  const artistId = randomUUID();
  const originalId = randomUUID();
  const printsId = randomUUID();
  const optionId = randomUUID();
  const orderId = randomUUID();
  const otherOrderId = randomUUID();
  const editionIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  const printLineId = randomUUID();
  const framingLineId = randomUUID();
  const secondLineId = randomUUID();
  const releasedLineId = randomUUID();
  const otherLineId = randomUUID();
  const proofEditionId = randomUUID();
  const proofLineId = randomUUID();
  const proofListingId = randomUUID();
  const proofListingEditionId = randomUUID();
  const proofListingLineId = randomUUID();
  const due = new Date("2026-12-01T09:00:00.000Z");
  let owner: pg.Pool;
  let reference = "";

  const order = (id: string, paid: boolean) =>
    owner.query(
      `insert into shop_order (id, identity_subject_id, fulfilment, merchandise_subtotal_pence,
         fulfilment_surcharge_pence, total_pence, idempotency_key, status, paid_at)
       values ($1, $2, 'uk_insured_delivery', 1000, 0, 1000, $3, $4::shop_order_status, $5)`,
      [id, `subject-${tag}`, `order-${id}`, paid ? "paid" : "pending_payment", paid ? due : null],
    );
  const goods = (
    id: string,
    inOrder: string,
    edition: string,
    number: number,
    listing = printsId,
  ) =>
    owner.query(
      `insert into shop_order_line (id, order_id, edition_id, artwork_id, unit_price_pence,
         edition_number, print_label)
       values ($1, $2, $3, $4, 1000, $5, $6)`,
      [id, inOrder, edition, listing, number, `${number}/25`],
    );

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
      `order-artist-${tag}`,
    ]);
    await owner.query(
      `insert into shop_artwork (id, slug, title, artist_id, eligible_for_edition_allocation, import_key, zoho_product_id)
       values ($1, $2, 'Harbour at dusk', $3, false, $4, $5)`,
      [originalId, `harbour-${tag}`, artistId, `order-facts:${tag}:o`, `zp-${tag}`],
    );
    await owner.query(
      `insert into shop_artwork (id, slug, title, artist_id, eligible_for_edition_allocation, import_key,
         source_original_artwork_id, run_kind, run_role, run_template, run_size, alloc_buyer,
         alloc_artist, alloc_lax, print_size, print_paper, print_frame)
       values ($1, $2, 'Harbour at dusk (prints)', $3, true, $4, $5, 'limited', 'main', 'custom',
         25, 10, 10, 5, 'A3', 'Hahnemühle Photo Rag', null)`,
      [printsId, `harbour-prints-${tag}`, artistId, `order-facts:${tag}:p`, originalId],
    );
    const allocations = ["original_buyer_entitlement", "artist", "artist", "lax"];
    for (const [i, id] of editionIds.entries()) {
      await owner.query(
        `insert into shop_edition (id, artwork_id, allocation, edition_number, stock_ref)
         values ($1, $2, $3::shop_edition_allocation, $4, $4)`,
        [id, printsId, allocations[i], i + 1],
      );
    }
    // An artist's proof kept on the main listing is sold, but is not part of the numbered run.
    await owner.query(
      `insert into shop_edition (id, artwork_id, allocation, stock_ref, proof_number)
       values ($1, $2, 'lax', 5, 1)`,
      [proofEditionId, printsId],
    );
    // The artist's proofs listed on their own, linked to the main run: not part of its ledger.
    await owner.query(
      `insert into shop_artwork (id, slug, title, artist_id, eligible_for_edition_allocation, import_key,
         source_original_artwork_id, run_kind, run_role, run_size, alloc_buyer, alloc_artist,
         alloc_lax, main_run_artwork_id, proof_type, print_size, print_paper)
       values ($1, $2, 'Harbour at dusk (AP)', $3, true, $4, $5, 'limited', 'proof', 1, 0, 0, 1,
         $6, 'ap', 'A3', 'Hahnemühle Photo Rag')`,
      [
        proofListingId,
        `harbour-ap-${tag}`,
        artistId,
        `order-facts:${tag}:ap`,
        originalId,
        printsId,
      ],
    );
    await owner.query(
      `insert into shop_edition (id, artwork_id, allocation, edition_number, stock_ref)
       values ($1, $2, 'lax', 1, 1)`,
      [proofListingEditionId, proofListingId],
    );
    await owner.query(
      `insert into shop_framing_option (id, code, name, frame, mount, glazing, hanging,
         lead_time_min_days, lead_time_max_days)
       values ($1, $2, 'Gallery black', 'black_wood', 'window_conservation', 'uv_acrylic',
         'd_rings_cord', 10, 15)`,
      [optionId, `gallery-black-${tag}`],
    );

    await order(orderId, true);
    await order(otherOrderId, false);
    await goods(printLineId, orderId, editionIds[0] as string, 1);
    await goods(secondLineId, orderId, editionIds[1] as string, 2);
    await goods(releasedLineId, orderId, editionIds[2] as string, 3);
    await goods(otherLineId, otherOrderId, editionIds[3] as string, 4);
    await goods(proofLineId, orderId, proofEditionId, 5);
    await goods(proofListingLineId, orderId, proofListingEditionId, 1, proofListingId);
    await owner.query("update shop_order_line set released_at = now() where id = $1", [
      releasedLineId,
    ]);
    await owner.query(
      "update shop_order_line set pack_confirmed_at = now(), pack_confirmed_by = 'staff' where id = $1",
      [secondLineId],
    );
    await owner.query(
      `insert into shop_order_line (id, order_id, kind, framing_for_line_id, framing_option_id,
         framing_snapshot, unit_price_pence)
       values ($1, $2, 'framing', $3, $4, $5, 12000)`,
      [
        framingLineId,
        orderId,
        printLineId,
        optionId,
        JSON.stringify({
          optionId,
          name: "Gallery black",
          frame: "black_wood",
          mount: "window_conservation",
          glazing: "uv_acrylic",
          hanging: "d_rings_cord",
          leadTimeMinDays: 10,
          leadTimeMaxDays: 15,
          pricePence: 12000,
        }),
      ],
    );
    await owner.query(
      "insert into shop_framing_task (order_line_id, status, due_at) values ($1, 'framing', $2)",
      [framingLineId, due],
    );
    await owner.query(
      `insert into shop_fulfilment (order_id, option, status, carrier, tracking_number)
       values ($1, 'uk_insured_delivery', 'in_transit', 'DPD', '15501234')`,
      [orderId],
    );
    const ref = await owner.query<{ reference: string }>(
      "select reference from shop_order where id = $1",
      [orderId],
    );
    reference = ref.rows[0]?.reference ?? "";
  });

  afterAll(async () => {
    if (!owner) return;
    const client = await owner.connect();
    try {
      await client.query("begin");
      // A framing line is fixed once written; only the test's own rows are removed, with the
      // triggers off for this transaction.
      await client.query("set local session_replication_role = replica");
      await client.query("delete from shop_fulfilment where order_id = $1", [orderId]);
      await client.query("delete from shop_framing_task where order_line_id = $1", [framingLineId]);
      await client.query("delete from shop_order_line where id = $1", [framingLineId]);
      await client.query("delete from shop_order_line where order_id in ($1, $2)", [
        orderId,
        otherOrderId,
      ]);
      await client.query("delete from shop_order where id in ($1, $2)", [orderId, otherOrderId]);
      await client.query("delete from shop_framing_option where id = $1", [optionId]);
      await client.query("delete from shop_edition where artwork_id in ($1, $2)", [
        printsId,
        proofListingId,
      ]);
      await client.query("delete from shop_artwork where id = $1", [proofListingId]);
      await client.query("delete from shop_artwork where id in ($1, $2)", [printsId, originalId]);
      await client.query("delete from shop_artist where id = $1", [artistId]);
      await client.query("delete from shop_party where id = $1", [partyId]);
      await client.query("commit");
    } finally {
      client.release();
      await owner.end();
    }
  });

  it("reads the order's prints with their listing, frame and the fulfilment", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
    const reader = createDrizzleOrderFulfilmentFactsReader(createDb(workerUrl!));
    const facts = await reader.read(orderId);
    expect(facts).toMatchObject({
      orderId,
      reference,
      paid: true,
      anyPackConfirmed: true,
      fulfilment: { status: "in_transit", carrier: "DPD", trackingNumber: "15501234" },
    });
    expect(reference).toMatch(/^LAX-S-/);
    const first = facts?.prints.find((line) => line.lineId === printLineId);
    expect(first).toEqual({
      lineId: printLineId,
      released: false,
      printsArtworkId: printsId,
      isMainRun: true,
      originalZohoProductId: `zp-${tag}`,
      editionType: "Numbered",
      runSize: 25,
      printSize: "A3",
      printPaper: "Hahnemühle Photo Rag",
      printFrame: null,
      framedByArtist: false,
      allocation: "original_buyer_entitlement",
      editionNumber: 1,
      printLabel: "1/25",
      framing: {
        lineId: framingLineId,
        name: "Gallery black",
        frame: "black_wood",
        mount: "window_conservation",
        glazing: "uv_acrylic",
        hanging: "d_rings_cord",
        leadTimeMinDays: 10,
        leadTimeMaxDays: 15,
        taskStatus: "framing",
        dueAt: due,
        released: false,
      },
    });
    expect(facts?.prints.map((line) => [line.lineId, line.released, line.framing]).sort()).toEqual(
      [
        [printLineId, false, first?.framing],
        [releasedLineId, true, null],
        [proofLineId, false, null],
        [secondLineId, false, null],
        [proofListingLineId, false, null],
      ].sort(),
    );
    // Only the main run's own listing is counted on the group's ledger.
    expect(
      facts?.prints.filter((line) => line.isMainRun).map((line) => line.printsArtworkId),
    ).toEqual([printsId, printsId, printsId, printsId]);
    expect(facts?.prints.find((line) => line.lineId === proofListingLineId)).toMatchObject({
      printsArtworkId: proofListingId,
      isMainRun: false,
      originalZohoProductId: `zp-${tag}`,
    });
  });

  it("counts the run's prints sold on paid orders and not released, by who held them, without proofs", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
    const reader = createDrizzleOrderFulfilmentFactsReader(createDb(workerUrl!));
    expect(await reader.runSales(printsId)).toEqual({ collector: 1, artist: 1, lax: 0 });
  });

  it("says an unpaid order is not paid, and a missing order is null", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
    const reader = createDrizzleOrderFulfilmentFactsReader(createDb(workerUrl!));
    expect(await reader.read(otherOrderId)).toMatchObject({ paid: false, fulfilment: null });
    expect(await reader.read(randomUUID())).toBeNull();
  });
});
