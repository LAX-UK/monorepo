import type { Database } from "@auction/db";
import {
  shopArtwork,
  shopCertificate,
  shopEdition,
  shopEditionEvent,
  shopEditionFacts,
  shopOrder,
  shopOrderLine,
  shopParty,
  shopPayoutLedger,
} from "@auction/db/schema";
import type { AdminEditionFacts } from "@auction/shop-contracts";
import { ShopDomainError } from "@auction/shop-domain";
import { and, eq, inArray } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { editionFactsInput } from "../../application/edition-runs/edition-run-input.js";
import { createEditionRunServices } from "../../application/edition-runs/edition-run-services.js";
import { createPrintFulfilmentServices } from "../../application/print-fulfilment/print-fulfilment-services.js";
import { integrationSuffix, requireDefined } from "../../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../../test-support/shop-integration-setup.js";
import { createDrizzleArtistCatalogueWriter } from "../drizzle-artist-catalogue.writer.js";
import { createDrizzleArtworkCatalogueWriter } from "../drizzle-artwork-catalogue.writer.js";
import { completeShopCheckoutSession } from "../drizzle-payment-event.processor.js";
import { createDrizzleSaleAuthorityWriter } from "../drizzle-sale-authority.writer.js";
import { createDrizzleShopUnitOfWork } from "../drizzle-shop-transaction-effects.js";
import { createDrizzleStaffNameReader } from "../drizzle-staff-name.reader.js";
import { createDrizzleEditionRunUnitOfWork } from "../edition-runs/drizzle-edition-run.unit-of-work.js";
import { reserveEditionsForCheckoutOrder } from "../shop-checkout-reservation.js";
import { createShopDomainEventPublisher } from "../shop-domain-event-publisher.js";
import {
  createDrizzlePickListReader,
  createDrizzlePrintFulfilmentUnitOfWork,
} from "./drizzle-print-fulfilment.unit-of-work.js";
import { linesAwaitingPackConfirmation } from "./packing-gate.js";

const ACTOR = "print-fulfilment-it-staff";
const key = () => `idem-${integrationSuffix("pf")}`;
const resolveMediaUrl = (value: string | null | undefined) => (value ? `/${value}` : null);

const PAPER_CERTIFICATE_FACTS = {
  numbering: "on_print",
  signature: { kind: "hand_signed", medium: "pencil", place: "front_lower_margin" },
  certificate: {
    kind: "included",
    issuer: "artist",
    form: "paper",
    arrives: { kind: "with_print" },
    numberedToMatch: true,
  },
} as const;

describe.skipIf(!hasShopIntegrationDb)("packing numbered prints", { timeout: 90_000 }, () => {
  let shopPool: pg.Pool;
  let ownerPool: pg.Pool;
  let db: Database;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
    db = createShopDb(shopPool);
  });

  afterAll(async () => {
    await shopPool.end();
    await ownerPool.end();
  });

  function setup(options: { laxCertificates?: boolean } = {}) {
    const uow = createDrizzleShopUnitOfWork(db, "off");
    const runs = createEditionRunServices({
      uow: createDrizzleEditionRunUnitOfWork(uow),
      clock: { now: () => new Date() },
    });
    const fulfilment = createPrintFulfilmentServices({
      uow: createDrizzlePrintFulfilmentUnitOfWork(uow),
      pickList: createDrizzlePickListReader(db),
      staffNames: createDrizzleStaffNameReader(db),
      certificateSettings: { laxCertificatesEnabled: () => options.laxCertificates ?? false },
      clock: { now: () => new Date() },
    });
    return {
      runs,
      fulfilment,
      writer: createDrizzleArtworkCatalogueWriter(uow, {
        resolveMediaUrl,
        editionRuns: runs.recorder,
        originalPrints: runs.originalPrintsRecorder,
        releaseAlerts: { recordPublished: async () => ({ queued: 0 }) },
      }),
      artists: createDrizzleArtistCatalogueWriter(uow),
      authority: createDrizzleSaleAuthorityWriter(db, "off"),
    };
  }

  /** A published run of 12: prints 1–8 the artist's, 9–12 LAX's, all on sale. */
  async function runOfTwelve(
    label: string,
    certificate: AdminEditionFacts["certificate"] = PAPER_CERTIFICATE_FACTS.certificate,
  ) {
    const { artists, writer, runs } = setup();
    const artist = await artists.createArtist({
      displayName: `Artist ${label}`,
      slug: `it-pf-artist-${integrationSuffix(label)}`,
      discipline: null,
      actorSubjectId: ACTOR,
      idempotencyKey: key(),
    });
    const created = await writer.createArtwork({
      slug: `it-pf-${integrationSuffix(label)}`,
      title: `Packing ${label}`,
      artistId: artist.artistId,
      yearCreated: 2025,
      medium: "Giclée",
      dimensions: null,
      description: null,
      run: {
        spec: { type: "custom_limited", size: 12, allocation: { buyer: 0, artist: 8, lax: 4 } },
        proofsKept: { ap: 0, pp: 0, hc: 0, bat: 0 },
      },
      printPricePence: 42_000,
      saleState: "for_sale",
      salesChannel: "shop",
      images: [],
      seoTitle: null,
      seoDescription: null,
      canSetPrice: true,
      actorSubjectId: ACTOR,
      idempotencyKey: key(),
    });
    await runs.facts.save({
      actorSubjectId: ACTOR,
      idempotencyKey: key(),
      artworkId: created.artworkId,
      facts: editionFactsInput({ ...PAPER_CERTIFICATE_FACTS, certificate }),
      confirmed: true,
      expectedFactsVersion: null,
    });
    await db
      .update(shopArtwork)
      .set({ publishedAt: new Date() })
      .where(eq(shopArtwork.id, created.artworkId));
    await db
      .update(shopEdition)
      .set({ listingStatus: "authorised", saleAuthorisedAt: new Date() })
      .where(eq(shopEdition.artworkId, created.artworkId));
    return created.artworkId;
  }

  /** One buyer pays for the next print on sale; returns the order line. */
  async function buyNextPrint(artworkId: string) {
    const events = createShopDomainEventPublisher("off");
    const suffix = integrationSuffix("buy");
    const subject = `subject-${suffix}`;
    const [order] = await db
      .insert(shopOrder)
      .values({
        identitySubjectId: subject,
        fulfilment: "collect_brunswick",
        merchandiseSubtotalPence: 42_000,
        fulfilmentSurchargePence: 0,
        totalPence: 42_000,
        idempotencyKey: `idem-${suffix}`,
        status: "pending_payment",
        stripeCheckoutSessionId: `cs_test_${suffix}`,
      })
      .returning({ id: shopOrder.id });
    const orderId = requireDefined(order?.id, "order");
    await db.transaction((tx) =>
      reserveEditionsForCheckoutOrder(
        tx as unknown as Database,
        {
          orderId,
          reservedUntil: new Date(Date.now() + 60_000),
          expandedLines: [{ artworkId, unitPricePence: 42_000 }],
        },
        events,
      ),
    );
    await completeShopCheckoutSession(
      db,
      {
        eventId: `evt-${suffix}`,
        orderId,
        sessionId: `cs_test_${suffix}`,
        amountTotalPence: 42_000,
        paidAt: new Date(),
      },
      { domainEventMode: "off" },
    );
    const [line] = await db
      .select()
      .from(shopOrderLine)
      .where(eq(shopOrderLine.orderId, orderId))
      .limit(1);
    return { orderId, line: requireDefined(line, "line") };
  }

  const stockRefOf = async (editionId: string) =>
    requireDefined(
      (
        await db
          .select({ stockRef: shopEdition.stockRef })
          .from(shopEdition)
          .where(eq(shopEdition.id, editionId))
      )[0]?.stockRef,
      "stock ref",
    );

  it("confirms the print sold, records who and when, and issues the paper certificate once", async () => {
    const { fulfilment } = setup();
    const artworkId = await runOfTwelve("confirm");
    const { orderId, line } = await buyNextPrint(artworkId);
    expect(await linesAwaitingPackConfirmation(db, orderId)).toEqual([line.id]);

    const wrong = await fulfilment.confirm.confirm({
      actorSubjectId: ACTOR,
      idempotencyKey: key(),
      orderLineId: line.id,
      scanned: { source: "typed_label", value: "12/12" },
    });
    expect(wrong.outcome).not.toBe("confirmed");
    expect(await linesAwaitingPackConfirmation(db, orderId)).toEqual([line.id]);

    const first = await fulfilment.confirm.confirm({
      actorSubjectId: ACTOR,
      idempotencyKey: key(),
      orderLineId: line.id,
      scanned: { source: "typed_label", value: "1/12" },
    });
    expect(first).toMatchObject({
      outcome: "confirmed",
      label: "1/12",
      certificate: { status: "issued" },
    });
    // A repeated confirmation, under another key, changes nothing.
    await fulfilment.confirm.confirm({
      actorSubjectId: ACTOR,
      idempotencyKey: key(),
      orderLineId: line.id,
      scanned: { source: "typed_label", value: "1/12" },
    });

    const [after] = await db.select().from(shopOrderLine).where(eq(shopOrderLine.id, line.id));
    expect(after).toMatchObject({ packConfirmedBy: ACTOR, printLabel: "1/12" });
    expect(after?.packConfirmedAt).toBeInstanceOf(Date);
    const certificates = await db
      .select()
      .from(shopCertificate)
      .where(eq(shopCertificate.editionId, line.editionId ?? ""));
    expect(certificates).toHaveLength(1);
    expect(certificates[0]).toMatchObject({ printLabel: "1/12", issuer: "artist", form: "paper" });
    expect(certificates[0]?.certificateReference).toMatch(/^LAX-C-[A-Z2-9]{8}$/);
    const events = await db
      .select({ kind: shopEditionEvent.kind })
      .from(shopEditionEvent)
      .where(eq(shopEditionEvent.editionId, line.editionId ?? ""));
    expect(events.map((e) => e.kind).sort()).toEqual(["certificate_issued", "pack_confirmed"]);
    expect(await linesAwaitingPackConfirmation(db, orderId)).toEqual([]);

    const list = await fulfilment.pickAndPack.forOrder(orderId);
    expect(list.lines[0]).toMatchObject({
      label: "1/12",
      numbered: true,
      certificate: { status: "issued" },
    });
  });

  it("never gives two orders the same replacement, or skips a free print, under concurrent swaps", async () => {
    const { fulfilment } = setup();
    const artworkId = await runOfTwelve("race");
    const bought = [];
    for (let i = 0; i < 4; i += 1) bought.push(await buyNextPrint(artworkId));
    expect(await Promise.all(bought.map((b) => stockRefOf(b.line.editionId ?? "")))).toEqual([
      1, 2, 3, 4,
    ]);

    const results = await Promise.allSettled(
      bought.map(({ line }) =>
        fulfilment.swap.swap({
          actorSubjectId: ACTOR,
          idempotencyKey: key(),
          orderLineId: line.id,
          toEditionId: undefined,
          reason: "Creased in the drawer",
          canSwapAcrossOwners: true,
        }),
      ),
    );
    expect(results.map((r) => r.status)).toEqual([
      "fulfilled",
      "fulfilled",
      "fulfilled",
      "fulfilled",
    ]);
    const lines = await db
      .select({ editionId: shopOrderLine.editionId })
      .from(shopOrderLine)
      .where(
        inArray(
          shopOrderLine.id,
          bought.map((b) => b.line.id),
        ),
      );
    const sent = await Promise.all(lines.map((l) => stockRefOf(l.editionId ?? "")));
    // The artist's own free prints go first, lowest first: 5, 6, 7, 8, each to one order.
    expect(sent.sort((a, b) => a - b)).toEqual([5, 6, 7, 8]);
    const withdrawn = await db
      .select({ stockRef: shopEdition.stockRef })
      .from(shopEdition)
      .where(and(eq(shopEdition.artworkId, artworkId), eq(shopEdition.listingStatus, "withdrawn")));
    expect(withdrawn.map((w) => w.stockRef).sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
    const sold = await db
      .select({ stockRef: shopEdition.stockRef })
      .from(shopEdition)
      .where(and(eq(shopEdition.artworkId, artworkId), eq(shopEdition.listingStatus, "sold")));
    expect(sold.map((s) => s.stockRef).sort((a, b) => a - b)).toEqual([5, 6, 7, 8]);
  });

  it("stops at the last free print: more swaps than prints free exactly that many", async () => {
    const { fulfilment } = setup();
    const artworkId = await runOfTwelve("scarce");
    const bought = [];
    for (let i = 0; i < 4; i += 1) bought.push(await buyNextPrint(artworkId));
    // Leave three free prints (10, 11, 12): the artist's 5–8 and LAX's 9 are taken elsewhere.
    await db
      .update(shopEdition)
      .set({ listingStatus: "held" })
      .where(
        and(eq(shopEdition.artworkId, artworkId), inArray(shopEdition.stockRef, [5, 6, 7, 8, 9])),
      );
    const results = await Promise.allSettled(
      bought.map(({ line }) =>
        fulfilment.swap.swap({
          actorSubjectId: ACTOR,
          idempotencyKey: key(),
          orderLineId: line.id,
          toEditionId: undefined,
          reason: "Water damage",
          canSwapAcrossOwners: true,
        }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    const refused = results.filter((r) => r.status === "rejected");
    expect(refused).toHaveLength(1);
    expect((refused[0] as PromiseRejectedResult).reason).toBeInstanceOf(ShopDomainError);
    const sold = await db
      .select({ stockRef: shopEdition.stockRef })
      .from(shopEdition)
      .where(and(eq(shopEdition.artworkId, artworkId), eq(shopEdition.listingStatus, "sold")));
    // The order that could not be moved keeps its print; the other three have 10, 11 and 12.
    expect(sold.map((s) => s.stockRef).sort((a, b) => a - b)).toHaveLength(4);
    expect(sold.filter((s) => s.stockRef >= 10)).toHaveLength(3);
  });

  it("moves the seller and the pending payout when an admin sends a print another party owns", async () => {
    const { fulfilment } = setup();
    const artworkId = await runOfTwelve("cross");
    const { line } = await buyNextPrint(artworkId);
    // Only LAX's prints are free.
    await db
      .update(shopEdition)
      .set({ listingStatus: "held" })
      .where(and(eq(shopEdition.artworkId, artworkId), eq(shopEdition.allocation, "artist")));

    const command = {
      actorSubjectId: ACTOR,
      orderLineId: line.id,
      toEditionId: undefined,
      reason: "Print 1 is missing",
    };
    await expect(
      fulfilment.swap.swap({
        ...command,
        idempotencyKey: key(),
        canSwapAcrossOwners: false,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    const [stillArtist] = await db
      .select()
      .from(shopOrderLine)
      .where(eq(shopOrderLine.id, line.id));
    expect(stillArtist?.editionId).toBe(line.editionId);

    const [ledgerBefore] = await db
      .select()
      .from(shopPayoutLedger)
      .where(eq(shopPayoutLedger.orderLineId, line.id));
    expect(ledgerBefore?.status).toBe("pending_refund_period");

    const result = await fulfilment.swap.swap({
      ...command,
      idempotencyKey: key(),
      canSwapAcrossOwners: true,
    });
    expect(result).toMatchObject({ label: "9/12", previousLabel: "1/12", payoutMoved: true });
    const [moved] = await db.select().from(shopOrderLine).where(eq(shopOrderLine.id, line.id));
    const [lax] = await db.select().from(shopParty).where(eq(shopParty.kind, "lax"));
    expect(moved).toMatchObject({
      sellerPartyId: lax?.id,
      swappedFromEditionId: line.editionId,
      printLabel: "9/12",
      editionNumber: 9,
    });
    // LAX is its own seller, so there is no artist payout left to pay.
    const [ledgerAfter] = await db
      .select()
      .from(shopPayoutLedger)
      .where(eq(shopPayoutLedger.orderLineId, line.id));
    expect(ledgerAfter?.status).toBe("cancelled");
    const [setAside] = await db
      .select()
      .from(shopEdition)
      .where(eq(shopEdition.id, line.editionId ?? ""));
    expect(setAside).toMatchObject({
      listingStatus: "withdrawn",
      withdrawnReason: "Print 1 is missing",
    });
  });

  it("holds a LAX certificate until the artist's authority is recorded", async () => {
    const { fulfilment } = setup({ laxCertificates: true });
    const artworkId = await runOfTwelve("authority", {
      kind: "included",
      issuer: "lax",
      form: "digital",
      arrives: { kind: "with_print" },
      numberedToMatch: true,
    });
    const { orderId, line } = await buyNextPrint(artworkId);
    const confirm = () =>
      fulfilment.confirm.confirm({
        actorSubjectId: ACTOR,
        idempotencyKey: key(),
        orderLineId: line.id,
        scanned: { source: "typed_label", value: "1/12" },
      });
    await expect(confirm()).rejects.toMatchObject({ statusCode: 409 });
    expect(await linesAwaitingPackConfirmation(db, orderId)).toEqual([line.id]);

    await fulfilment.certificates.recordAuthority({
      actorSubjectId: ACTOR,
      idempotencyKey: key(),
      artworkId,
      reference: "Letter of 3 October 2026",
    });
    const [facts] = await db
      .select()
      .from(shopEditionFacts)
      .where(eq(shopEditionFacts.artworkId, artworkId));
    expect(facts).toMatchObject({
      certificateAuthorityReference: "Letter of 3 October 2026",
      certificateAuthorityRecordedBy: ACTOR,
    });
    expect(await confirm()).toMatchObject({
      outcome: "confirmed",
      certificate: { status: "issued" },
    });
    const [certificate] = await db
      .select()
      .from(shopCertificate)
      .where(eq(shopCertificate.editionId, line.editionId ?? ""));
    expect(certificate).toMatchObject({
      issuer: "lax",
      authorityReference: "Letter of 3 October 2026",
      issuedBySubjectId: ACTOR,
    });
  });

  it("offers a hors commerce proof for sale only after a shop admin approves it", async () => {
    const { runs, fulfilment, authority } = setup();
    const mainId = await runOfTwelve("hc-main");
    await db
      .update(shopArtwork)
      .set({ proofsKeptHc: 1, primaryImageUrl: "it-pf/hc-main.jpg" })
      .where(eq(shopArtwork.id, mainId));
    const listing = await runs.listings.createProofListing({
      actorSubjectId: ACTOR,
      idempotencyKey: key(),
      mainArtworkId: mainId,
      proofType: "hc",
      count: 1,
      owner: "lax",
      printPricePence: 30_000,
      horsCommerceApproved: true,
      canSetPrice: true,
      canApproveHorsCommerce: true,
    });
    const [approved] = await db
      .select()
      .from(shopArtwork)
      .where(eq(shopArtwork.id, listing.artworkId));
    expect(approved).toMatchObject({
      proofType: "hc",
      horsCommerceApprovedBySubjectId: ACTOR,
    });

    // Take the approval away, as for a listing carried over without one.
    await db
      .update(shopArtwork)
      .set({ horsCommerceApprovedAt: null, horsCommerceApprovedBySubjectId: null })
      .where(eq(shopArtwork.id, listing.artworkId));
    const [laxParty] = await db.select().from(shopParty).where(eq(shopParty.kind, "lax"));
    const grant = () =>
      authority.grantSaleAuthority({
        artworkId: listing.artworkId,
        ownerPartyId: requireDefined(laxParty?.id, "lax party"),
        authorisedCount: 1,
        evidenceNote: "one hors commerce proof",
        recordedBySubjectId: ACTOR,
      });
    await expect(grant()).rejects.toThrow(/shop admin approves/);
    await fulfilment.certificates.approveHorsCommerce({
      actorSubjectId: "shop-admin-subject",
      idempotencyKey: key(),
      artworkId: listing.artworkId,
    });
    expect((await grant()).authorisedCount).toBe(1);
  });

  it("refuses a second certificate for one print at the database", async () => {
    const { fulfilment } = setup();
    const artworkId = await runOfTwelve("unique");
    const { line } = await buyNextPrint(artworkId);
    await fulfilment.confirm.confirm({
      actorSubjectId: ACTOR,
      idempotencyKey: key(),
      orderLineId: line.id,
      scanned: { source: "typed_label", value: "1/12" },
    });
    await expect(
      db.insert(shopCertificate).values({ editionId: line.editionId ?? "", orderLineId: line.id }),
    ).rejects.toThrow();
  });
});
