import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createDb } from "@auction/db";
import { applyApplicationRoleGrants } from "@auction/db/migrate-roles";
import {
  DrizzleExportAdminUserReader,
  DrizzleExportDomainEventsQuery,
  DrizzleExportLegalEntityReader,
  DrizzleExportPayoutReader,
} from "@auction/exports/infrastructure";
import {
  BidAlertAnnouncementStore,
  BidAlertDigestLedger,
  BidAlertFollowerProvisioner,
  BidAlertInAppTopics,
  BidAlertLotNoticeWriter,
  BidAlertLotReader,
  BidAlertLotStart,
  BidAlertMatchLedger,
  BidAlertMatchValidator,
  BidAlertSaleNoticeWriter,
  BidAlertSaleReader,
  BidAlertSeed,
  BidAlertSubscriberStore,
  BidAlertTopicStore,
  BidAlertWatcherReader,
  DrizzleArtworkRegisterRepository,
  DrizzleBidAccountingFactsReader,
  DrizzleBidRepository,
  DrizzleFailedJobReviewRepository,
  DrizzleIntegrationDeadLetterRepository,
  DrizzleItemSubmissionRepository,
  DrizzleLotLifecycleSnapshotRepository,
  DrizzleLotRegisterLinkReader,
  DrizzleLotRepository,
  DrizzleNotificationOutboxRepository,
  DrizzlePaymentRepository,
  DrizzlePayoutAccountingFactsReader,
  DrizzleRecipientZoneReader,
  DrizzleRegisterLotIntegrityReader,
  DrizzleReofferInvoiceMarker,
  DrizzleReofferSweepReader,
  DrizzleSaleRepository,
  DrizzleSellerConsentRepository,
  DrizzleShopAccountingFactsReader,
  DrizzleSoldAttentionStore,
  DrizzleUnappliedMoneyReader,
  DrizzleUnsoldChoiceDeadlineStore,
  DrizzleUnsoldLotFollowUpRepository,
  DrizzleWebhookEventRepository,
  DrizzleZohoArtworkSyncStore,
  DrizzleZohoListingLock,
  DrizzleZohoListingRunStore,
  DrizzleZohoListingSourceReader,
  DrizzleZohoLocationSourceReader,
  DrizzleZohoSyncHealthStore,
} from "@auction/persistence/repositories";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { DrizzleAtgSyncStore } from "../integrations/atg/drizzle-atg-sync-store.js";
import { DrizzleProjectorCursorStart } from "../repositories/drizzle-projector-cursor-start.js";
import { DrizzleWebPublicCacheReader } from "../repositories/drizzle-web-public-cache.reader.js";
import { DrizzleZohoCampaignsSuppressionRepository } from "../repositories/drizzle-zoho-campaigns-suppression.repository.js";
import { ShopIdentityProjectionService } from "../services/shop-identity-projection.service.js";
import type { WorkerDb } from "../workers/types.js";
import {
  PROBE_BID_PAYOUT_ID,
  PROBE_LOT_ID,
  PROBE_SHOP_GUEST_ORDER_ID,
  PROBE_SHOP_ORIGINAL_SALE_ID,
  PROBE_SHOP_PAYOUT_LEDGER_ID,
  PROBE_SHOP_USER_ORDER_ID,
  PROBE_USER_ID,
  alertMatch,
  consent,
  issuedRegisterEntry,
  lifecycleSnapshot,
  newRegisterEntry,
  outcomeKey,
  registerActor,
  sellerConsentAnswer,
  soldAttention,
  stockCodeSeries,
  today,
} from "./worker-role-contract.fixtures.js";
import { NIL, countStatements, runRolledBack } from "./worker-role-contract.test-helpers.js";

const workerUrl = process.env.DATABASE_URL_WORKER;
const ownerUrl = process.env.MIGRATION_TEST_DATABASE_URL;

/**
 * The stores the worker builds outside `createWorkerRepositories`: the alert, ATG, Zoho and export
 * runtimes and the stores wired in `create-worker-container.ts`. Each is built on a rolled-back
 * transaction as `worker_app` and every public method is called (see worker-role-contract.
 * integration.test.ts for why only a denial can fail a call).
 *
 * Arguments are guessed from parameter names: ids and strings get an id that matches nothing, dates
 * a date, counts a number. A call that fails before it reaches PostgreSQL is not a failure, it is
 * just not proof, and is listed in the test output so its probe can be written by hand.
 */

type Store = new (db: WorkerDb) => object;

/** Every store a container file builds on the worker database, by class name. */
const STORES: Record<string, Store> = {
  BidAlertSubscriberStore,
  BidAlertTopicStore,
  BidAlertMatchLedger,
  BidAlertDigestLedger,
  BidAlertSeed,
  BidAlertAnnouncementStore,
  BidAlertSaleReader,
  BidAlertSaleNoticeWriter,
  BidAlertLotStart,
  BidAlertLotReader,
  BidAlertWatcherReader,
  BidAlertFollowerProvisioner,
  BidAlertMatchValidator,
  BidAlertLotNoticeWriter,
  BidAlertInAppTopics,
  DrizzleAtgSyncStore,
  DrizzleZohoArtworkSyncStore,
  DrizzleZohoListingSourceReader,
  DrizzleZohoListingLock,
  DrizzleZohoListingRunStore,
  DrizzleZohoLocationSourceReader,
  DrizzleZohoSyncHealthStore,
  DrizzleZohoCampaignsSuppressionRepository,
  DrizzleArtworkRegisterRepository,
  DrizzleLotRegisterLinkReader,
  DrizzleRegisterLotIntegrityReader,
  DrizzleUnsoldChoiceDeadlineStore,
  DrizzleUnsoldLotFollowUpRepository,
  DrizzleWebhookEventRepository,
  ShopIdentityProjectionService,
  DrizzleLotRepository,
  DrizzleSaleRepository,
  DrizzleSoldAttentionStore,
  DrizzleItemSubmissionRepository,
  DrizzleLotLifecycleSnapshotRepository,
  DrizzleNotificationOutboxRepository,
  DrizzleReofferInvoiceMarker,
  DrizzleReofferSweepReader,
  DrizzleSellerConsentRepository,
  DrizzlePaymentRepository,
  DrizzleRecipientZoneReader,
  DrizzleExportAdminUserReader,
  DrizzleExportDomainEventsQuery,
  DrizzleExportPayoutReader,
  DrizzleExportLegalEntityReader,
  DrizzleBidAccountingFactsReader,
  DrizzleShopAccountingFactsReader,
  DrizzlePayoutAccountingFactsReader,
  DrizzleUnappliedMoneyReader,
  DrizzleProjectorCursorStart,
  DrizzleFailedJobReviewRepository,
  DrizzleIntegrationDeadLetterRepository,
  DrizzleWebPublicCacheReader,
} as Record<string, Store>;

/** Built by `DrizzleRepositoryFactory`, which a container file builds, not by a container file itself. */
const BUILT_BY_FACTORY: Record<string, Store> = {
  DrizzleBidRepository,
} as Record<string, Store>;

/** Built in a container file but exercised elsewhere, with the reason. */
const COVERED_ELSEWHERE: Record<string, string> = {
  DrizzleDomainEventDeliveryRepository:
    "worker-role-contract.integration.test.ts (domainEventDeliveryRepo)",
  DrizzleRepositoryFactory: "its repositories are listed in BUILT_BY_FACTORY",
  DrizzleTransactionRunner:
    "opens a transaction for its caller; it reads and writes no table itself",
};

/**
 * Methods of repositories the API shares with the worker that only the API calls, so `worker_app`
 * rightly cannot run them. Everything not listed here must be allowed.
 */
const API_ONLY_METHODS: Record<string, readonly string[]> = {
  // Deleting a draft and purging deleted drafts (GAP-53) run in the API only.
  DrizzleItemSubmissionRepository: [
    "findByIdForUpdate",
    "update",
    "create",
    "softDeleteDraft",
    "purgeDeletedDrafts",
  ],
  DrizzlePaymentRepository: ["isVoidedByBuyerDefault"],
  DrizzleUnsoldLotFollowUpRepository: ["completeByStaff", "settleOnReturn"],
  DrizzleLotRepository: ["create", "update"],
  DrizzleSaleRepository: ["create", "update"],
  // The Failed jobs watch only counts what needs review; the review itself is the API's.
  DrizzleFailedJobReviewRepository: [
    "search",
    "findForReview",
    "findManyForReview",
    "discard",
    "restore",
  ],
  DrizzleIntegrationDeadLetterRepository: [
    "listFailedWebhooks",
    "search",
    "findForReview",
    "findManyForReview",
    "claimRetry",
    "releaseRetry",
    "discard",
    "restore",
    "requeue",
  ],
};

type Call = { method: string; parameters: string[] };

const COUNT_PARAMS =
  /^(limit|offset|batchSize|count|size|take|page|pageSize|attempts|hours|days|minutes|\w*Ms|max\w*|min\w*)$/i;
const DATE_PARAMS =
  /(date|at|since|before|after|cutoff|now|from|to|until|deadline|start|end|time|asOf|endAfter|endBeforeInclusive)$/i;
const OBJECT_PARAMS = /(filter|input|patch|query|options|opts|payload|params)$/i;
const LIST_PARAMS = /(ids|list|keys|emails|hashes|values)$/i;
const CONNECTION_PARAMS = /^(tx|db|conn|connection)$/;

function parameterNames(fn: (...args: never[]) => unknown): string[] {
  const text = Function.prototype.toString.call(fn);
  const open = text.indexOf("(");
  const close = text.indexOf(")", open);
  if (open < 0 || close < 0) return [];
  return text
    .slice(open + 1, close)
    .split(",")
    .map((part) => part.trim().replace(/^\.\.\./, ""))
    .filter(Boolean);
}

function guessArgument(parameter: string, connection: WorkerDb): unknown {
  const name = parameter.split(/[=:]/)[0]?.trim() ?? "";
  if (name.startsWith("{") || OBJECT_PARAMS.test(name)) return {};
  if (CONNECTION_PARAMS.test(name)) return connection;
  if (COUNT_PARAMS.test(name)) return 1;
  if (LIST_PARAMS.test(name)) return [NIL];
  if (DATE_PARAMS.test(name)) return new Date();
  return NIL;
}

/**
 * Arguments written by hand for calls the name-based guess cannot build (an object or a list of
 * objects). Without them these calls return before they reach a table, which proves nothing.
 * Keyed `Store.method`; each gets the transaction the call runs on.
 */
const ARGUMENTS: Record<string, (tx: WorkerDb) => unknown[]> = {
  "BidAlertMatchLedger.record": () => [[alertMatch()]],
  "BidAlertDigestLedger.claim": () => [
    {
      subscriberId: NIL,
      product: "bid",
      localDate: "2026-01-01",
      matchIds: [NIL],
      idempotencyKey: "role-contract",
      now: today,
    },
  ],
  "BidAlertLotReader.matchingSearch": () => [{ q: "role contract", categoryId: null }, [NIL]],
  "BidAlertMatchValidator.staleMatches": () => [[alertMatch()]],
  "BidAlertLotNoticeWriter.write": () => [
    {
      digestId: NIL,
      userId: NIL,
      notices: [
        {
          type: "artist_lots_listed",
          title: "Role contract",
          message: "Role contract",
          linkPath: "/",
        },
      ],
    },
  ],
  "DrizzleZohoArtworkSyncStore.record": () => [
    NIL,
    "dry_run",
    [
      {
        zohoProductId: "role-contract",
        stockCode: null,
        title: null,
        outcome: "skipped",
        reason: null,
        detail: {},
        zohoModifiedAt: null,
      },
    ],
    today,
  ],
  "DrizzleZohoListingRunStore.record": () => [
    {
      runId: NIL,
      mode: "dry_run",
      startedAt: today,
      finishedAt: today,
      checked: 0,
      changed: 0,
      unchanged: 0,
      failed: 0,
      failures: [],
    },
  ],
  "DrizzleZohoSyncHealthStore.reportModes": () => [{ artworkSync: "off", listing: "off" }, today],
  "DrizzleZohoSyncHealthStore.recordTokenRefreshed": () => [today, today],
  "DrizzleZohoSyncHealthStore.recordTokenRefreshFailed": () => ["role-contract", today],
  "DrizzleZohoListingSourceReader.registerIdsForSalesStartedBetween": () => [
    { from: today, to: today },
    null,
    1,
  ],
  "DrizzleZohoListingLock.withLock": () => [[NIL], async () => undefined],
  "DrizzleUnsoldChoiceDeadlineStore.keep": () => [[{ ...outcomeKey, chooseBy: today }]],
  "DrizzleUnsoldChoiceDeadlineStore.kept": () => [[outcomeKey]],
  "DrizzleUnsoldLotFollowUpRepository.findForOutcome": () => [outcomeKey],
  "DrizzleUnsoldLotFollowUpRepository.completeByStaff": () => [outcomeKey, NIL, today],
  "DrizzleUnsoldLotFollowUpRepository.settleOnReturn": (tx) => [tx, outcomeKey, NIL, today],
  "BidAlertTopicStore.setEmail": () => [NIL, "bid.new_sales", true, "staff", today],
  "BidAlertTopicStore.listEmailRecipients": () => ["bid.new_sales", NIL, 1],
  "BidAlertMatchLedger.pendingSubscribers": () => ["bid", NIL, 1],
  "BidAlertAnnouncementStore.claimItem": () => [`sale:${NIL}`, true, today],
  "DrizzleZohoListingSourceReader.pageOriginals": () => [NIL, 1],
  "DrizzleArtworkRegisterRepository.listOpenConflicts": () => [1, { detectedAt: today, id: NIL }],
  "DrizzleArtworkRegisterRepository.issue": () => [
    "original",
    issuedRegisterEntry(),
    registerActor,
    today,
  ],
  "DrizzleArtworkRegisterRepository.highestStockNumber": () => [stockCodeSeries],
  "DrizzleArtworkRegisterRepository.create": () => [newRegisterEntry(), registerActor, today],
  "BidAlertSubscriberStore.saveConfirmedForAccount": () => [
    {
      product: "bid",
      email: "role-contract@lax.bid.local",
      subjectId: PROBE_USER_ID,
      now: today,
      ...consent,
    },
  ],
  "BidAlertSaleNoticeWriter.notifySubscribers": () => [
    { saleId: NIL, title: "Role contract", message: "Role contract" },
  ],
  "ShopIdentityProjectionService.apply": () => [
    "user.registered",
    {
      userId: PROBE_USER_ID,
      email: "role-contract@lax.bid.local",
      name: "Role contract",
      source: "credential",
    },
  ],
  "DrizzleSaleRepository.findWithStatuses": () => [["draft", "active"]],
  "DrizzleUnappliedMoneyReader.existsForShopPayment": () => [
    { paymentIntentId: "pi_role_contract", sessionId: "cs_role_contract" },
  ],
  "DrizzleUnappliedMoneyReader.wasEverUnapplied": () => [
    { chargeId: "ch_role_contract", paymentIntentId: "pi_role_contract" },
  ],
  "DrizzlePaymentRepository.recordTransferReceivedInTransaction": (tx) => [
    tx,
    NIL,
    100,
    "pi_role_contract",
  ],
  // The seeded paid orders and original sale, so the reader goes on to read the buyer: a guest
  // customer, a user profile, or (for an original) the party's account.
  "DrizzleShopAccountingFactsReader.orderPaid": () => [PROBE_SHOP_GUEST_ORDER_ID],
  "DrizzleShopAccountingFactsReader.forOrder": () => [PROBE_SHOP_USER_ORDER_ID],
  "DrizzleShopAccountingFactsReader.originalSalePaid": () => [PROBE_SHOP_ORIGINAL_SALE_ID],
  "DrizzleShopAccountingFactsReader.forOriginalSale": () => [PROBE_SHOP_ORIGINAL_SALE_ID],
  // The seeded payouts, so the reads reach the lines, seller terms and payee tables.
  "DrizzlePayoutAccountingFactsReader.bidPayout": () => [PROBE_BID_PAYOUT_ID],
  "DrizzlePayoutAccountingFactsReader.shopArtistPayout": () => [PROBE_SHOP_PAYOUT_LEDGER_ID],
  "DrizzleLotRepository.updateDutchCurrentPrice": () => [NIL, "1.00", today],
  "DrizzleLotRepository.updateDutchCurrentPriceIfMatch": () => [NIL, "2.00", "1.00", today],
  "DrizzleLotRepository.updateCurrentPrice": () => [NIL, "1.00"],
  "DrizzleLotRepository.updateStatus": () => [NIL, "active"],
  // Reads the lot before it writes, so it needs the lot the probe seed inserts.
  "DrizzleLotRepository.updateMarketingDetails": () => [PROBE_LOT_ID, {}],
  "DrizzleLotRepository.findPreviewLotsBySaleIds": () => [[NIL], 1],
  "DrizzleSaleRepository.updateStatus": () => [NIL, "active"],
  "DrizzlePaymentRepository.updateStatus": () => [NIL, "captured"],
  "DrizzleSoldAttentionStore.replace": () => [{ id: NIL, now: today, raise: soldAttention() }],
  "DrizzleSoldAttentionStore.listLive": () => [1, { raisedAt: today, id: NIL }],
  "DrizzleSoldAttentionStore.isPaused": () => [{ registerId: NIL }],
  "DrizzleLotLifecycleSnapshotRepository.upsertSnapshot": () => [lifecycleSnapshot()],
  "DrizzleReofferSweepReader.acceptedWithoutInvoice": () => [
    { reawardedBefore: today, retryMarkedBefore: today, limit: 1 },
  ],
  "DrizzleSellerConsentRepository.answer": (tx) => [tx, sellerConsentAnswer()],
};

/**
 * Methods that run their statement and then refuse in code because the row is not there, so the
 * statement ran and the grant is proven. Keyed `Store.method`, with the message they throw.
 */
const REFUSES_AFTER_STATEMENT: Record<string, RegExp> = {
  "DrizzleSellerConsentRepository.answer": /offer changed/,
};

/** A second set of arguments for a method with two paths to a table, keyed `Store.method`. */
const VARIANTS: Record<string, Record<string, (tx: WorkerDb) => unknown[]>> = {
  "DrizzleShopAccountingFactsReader.forOrder": {
    "a guest's order": () => [PROBE_SHOP_GUEST_ORDER_ID],
  },
  // A print names its source original, which is looked up before the print is inserted.
  "DrizzleArtworkRegisterRepository.create": {
    "a print from an original": () => [
      { ...newRegisterEntry(), kind: "print", sourceOriginalId: NIL },
      registerActor,
      today,
    ],
  },
};

/**
 * Private helpers that TypeScript hides but the prototype walk still lists. Each runs inside a
 * public method that is probed itself, so it is covered there; with no arguments of its own to
 * build, calling it directly would only fail before PostgreSQL.
 */
const PRIVATE_HELPERS: Record<string, readonly string[]> = {
  BidAlertFollowerProvisioner: ["provision"],
  DrizzleZohoListingSourceReader: ["lotsFor", "dealsFor"],
  DrizzleArtworkRegisterRepository: [
    "findOne",
    "publishCatalogueChange",
    // Run by `create`, `issue` and `highestStockNumber`, which are probed with real entries.
    "insertEntry",
    "insertIssued",
    "highestNumber",
    "sourceOriginalIsValid",
  ],
  DrizzleSaleRepository: ["withCategoryIds"],
  DrizzleItemSubmissionRepository: ["withCategoryIds"],
  DrizzlePaymentRepository: ["listWithExternalRefs"],
  // Run by `forOrder`, `orderPaid`, `forOriginalSale` and `originalSalePaid` on the seeded rows.
  DrizzleShopAccountingFactsReader: ["buyer", "originalRecipient"],
};

/** Methods that only build another repository over a connection and send no statement of their own. */
const BUILDS_REPOSITORY: Record<string, readonly string[]> = {
  DrizzleArtworkRegisterRepository: ["withExecutor"],
  DrizzleLotLifecycleSnapshotRepository: ["forConnection"],
};

function publicMethods(store: object): Call[] {
  const calls: Call[] = [];
  for (
    let proto = Object.getPrototypeOf(store);
    proto && proto !== Object.prototype;
    proto = Object.getPrototypeOf(proto)
  ) {
    for (const method of Object.getOwnPropertyNames(proto)) {
      const fn = Object.getOwnPropertyDescriptor(proto, method)?.value;
      if (method === "constructor" || method.startsWith("_") || typeof fn !== "function") continue;
      if (calls.some((call) => call.method === method)) continue;
      calls.push({ method, parameters: parameterNames(fn) });
    }
  }
  return calls;
}

const containerDir = fileURLToPath(new URL(".", import.meta.url));

/** The class names a container file constructs with the worker database or a transaction of it. */
async function storesBuiltInContainerFiles(): Promise<string[]> {
  const names = new Set<string>();
  const files = (await readdir(containerDir)).filter(
    (name) =>
      name.endsWith(".ts") && !name.includes(".test") && name !== "create-worker-repositories.ts",
  );
  for (const file of files) {
    const source = ts.createSourceFile(
      file,
      await readFile(join(containerDir, file), "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    const visit = (node: ts.Node): void => {
      if (ts.isNewExpression(node) && node.arguments?.some(isDatabase)) {
        names.add(node.expression.getText(source));
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return [...names].sort();
}

function isDatabase(node: ts.Expression): boolean {
  if (ts.isIdentifier(node)) return node.text === "db" || node.text === "tx";
  return ts.isPropertyAccessExpression(node) && node.name.text === "db";
}

describe("stores built outside createWorkerRepositories", () => {
  it("has a probe for every store a container file builds on the database", async () => {
    const built = await storesBuiltInContainerFiles();
    const unlisted = built.filter((name) => !(name in STORES) && !(name in COVERED_ELSEWHERE));
    expect(unlisted, "add these stores to STORES, or to COVERED_ELSEWHERE with the reason").toEqual(
      [],
    );
    const stale = Object.keys(STORES).filter((name) => !built.includes(name));
    expect(stale, "no container file builds these stores any more").toEqual([]);
  });
});

/** True when `method` is on the class or one it extends (private ones included: they exist at runtime). */
function hasMethod(Store: Store, method: string): boolean {
  for (let proto = Store.prototype; proto && proto !== Object.prototype; ) {
    if (typeof Object.getOwnPropertyDescriptor(proto, method)?.value === "function") return true;
    proto = Object.getPrototypeOf(proto);
  }
  return false;
}

describe("the hand-kept probe lists", () => {
  const known = { ...STORES, ...BUILT_BY_FACTORY };
  const listed: [string, Record<string, readonly string[] | unknown>][] = [
    ["API_ONLY_METHODS", API_ONLY_METHODS],
    ["PRIVATE_HELPERS", PRIVATE_HELPERS],
    ["BUILDS_REPOSITORY", BUILDS_REPOSITORY],
  ];

  it.each(listed)("%s names only stores and methods that exist", (_list, entries) => {
    const missing = Object.entries(entries).flatMap(([name, methods]) =>
      known[name]
        ? (methods as readonly string[])
            .filter((method) => !hasMethod(known[name] as Store, method))
            .map((method) => `${name}.${method}`)
        : [`${name} (no such store)`],
    );
    expect(missing).toEqual([]);
  });

  it.each([
    ["ARGUMENTS", ARGUMENTS],
    ["VARIANTS", VARIANTS],
    ["REFUSES_AFTER_STATEMENT", REFUSES_AFTER_STATEMENT],
  ] as const)("%s names only methods that exist", (_list, entries) => {
    const missing = Object.keys(entries).filter((key) => {
      const [name = "", method = ""] = key.split(".");
      return !known[name] || !hasMethod(known[name] as Store, method);
    });
    expect(missing).toEqual([]);
  });
});

describe.skipIf(!ownerUrl || !workerUrl)("worker stores as worker_app", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
  const db = createDb(workerUrl!);
  countStatements(db as unknown as WorkerDb);
  const unreached: string[] = [];

  it("applies the role grants", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
    await applyApplicationRoleGrants(ownerUrl!);
  });

  const probed = { ...STORES, ...BUILT_BY_FACTORY };
  const calls = Object.entries(probed).flatMap(([name, Store]) =>
    publicMethods(new Store(db))
      .filter(({ method }) => !API_ONLY_METHODS[name]?.includes(method))
      .filter(({ method }) => !PRIVATE_HELPERS[name]?.includes(method))
      .filter(({ method }) => !BUILDS_REPOSITORY[name]?.includes(method))
      .flatMap(({ method }) => [
        [name, method, ""] as const,
        ...Object.keys(VARIANTS[`${name}.${method}`] ?? {}).map(
          (variant) => [name, method, ` (${variant})`] as const,
        ),
      ]),
  );

  it.each(calls)("%s.%s%s is not denied", async (name, method, variant) => {
    const refusal = REFUSES_AFTER_STATEMENT[`${name}.${method}`];
    const outcome = await runRolledBack(
      db,
      async (tx) => {
        const store = new (probed[name] as Store)(tx);
        const { parameters } = publicMethods(store).find((call) => call.method === method) ?? {
          parameters: [],
        };
        const written = variant
          ? VARIANTS[`${name}.${method}`]?.[variant.slice(2, -1)]
          : ARGUMENTS[`${name}.${method}`];
        const args = written?.(tx) ?? parameters.map((p) => guessArgument(p, tx));
        const fn = (store as Record<string, (...args: unknown[]) => unknown>)[method];
        return fn?.apply(store, args);
      },
      refusal,
    );
    const label = `${name}.${method}${variant}`;
    if (outcome.denied) throw new Error(`${label}: ${outcome.denied}`);
    if (!outcome.reachedDatabase)
      unreached.push(`${label}: ${outcome.failure ?? `${outcome.statements} statements sent`}`);
  });

  it("reports the calls that never reached PostgreSQL", () => {
    console.info(`not proven (${unreached.length} of ${calls.length}):\n${unreached.join("\n")}`);
    expect(unreached, "every probe must run a statement past the privilege check").toEqual([]);
  });
});
