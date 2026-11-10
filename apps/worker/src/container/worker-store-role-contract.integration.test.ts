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
  DrizzleBidRepository,
  DrizzleItemSubmissionRepository,
  DrizzleLotRegisterLinkReader,
  DrizzleLotRepository,
  DrizzlePaymentRepository,
  DrizzleSaleRepository,
  DrizzleUnsoldChoiceDeadlineStore,
  DrizzleUnsoldLotFollowUpRepository,
  DrizzleWebhookEventRepository,
  DrizzleZohoArtworkSyncStore,
  DrizzleZohoListingLock,
  DrizzleZohoListingRunStore,
  DrizzleZohoListingSourceReader,
} from "@auction/persistence/repositories";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { DrizzleAtgSyncStore } from "../integrations/atg/drizzle-atg-sync-store.js";
import { DrizzleZohoCampaignsSuppressionRepository } from "../repositories/drizzle-zoho-campaigns-suppression.repository.js";
import { ShopIdentityProjectionService } from "../services/shop-identity-projection.service.js";
import type { WorkerDb } from "../workers/types.js";
import { NIL, runRolledBack } from "./worker-role-contract.test-helpers.js";

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
  DrizzleAtgSyncStore,
  DrizzleZohoArtworkSyncStore,
  DrizzleZohoListingSourceReader,
  DrizzleZohoListingLock,
  DrizzleZohoListingRunStore,
  DrizzleZohoCampaignsSuppressionRepository,
  DrizzleArtworkRegisterRepository,
  DrizzleLotRegisterLinkReader,
  DrizzleUnsoldChoiceDeadlineStore,
  DrizzleUnsoldLotFollowUpRepository,
  DrizzleWebhookEventRepository,
  ShopIdentityProjectionService,
  DrizzleLotRepository,
  DrizzleSaleRepository,
  DrizzleItemSubmissionRepository,
  DrizzlePaymentRepository,
  DrizzleExportAdminUserReader,
  DrizzleExportDomainEventsQuery,
  DrizzleExportPayoutReader,
  DrizzleExportLegalEntityReader,
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
};

type Call = { method: string; args: unknown[] };

const COUNT_PARAMS =
  /^(limit|offset|batchSize|count|size|take|page|pageSize|attempts|max\w*|min\w*)$/i;
const DATE_PARAMS = /(date|at|since|before|after|cutoff|now|from|to|until|deadline)$/i;
const LIST_PARAMS = /(ids|list|keys|emails|hashes|values)$/i;

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

function argumentFor(parameter: string): unknown {
  const name = parameter.split(/[=:]/)[0]?.trim() ?? "";
  if (name.startsWith("{")) return {};
  if (COUNT_PARAMS.test(name)) return 1;
  if (LIST_PARAMS.test(name)) return [NIL];
  if (DATE_PARAMS.test(name)) return new Date();
  return NIL;
}

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
      calls.push({ method, args: parameterNames(fn).map(argumentFor) });
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

describe.skipIf(!ownerUrl || !workerUrl)("worker stores as worker_app", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
  const db = createDb(workerUrl!);
  const unreached: string[] = [];

  it("applies the role grants", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by skipIf
    await applyApplicationRoleGrants(ownerUrl!);
  });

  const probed = { ...STORES, ...BUILT_BY_FACTORY };
  const calls = Object.entries(probed).flatMap(([name, Store]) =>
    publicMethods(new Store(db)).map(({ method }) => [name, method] as const),
  );

  it.each(calls)("%s.%s is not denied", async (name, method) => {
    const outcome = await runRolledBack(db, async (tx) => {
      const store = new (probed[name] as Store)(tx);
      const call = publicMethods(store).find((candidate) => candidate.method === method);
      const fn = (store as Record<string, (...args: unknown[]) => unknown>)[method];
      return fn?.apply(store, call?.args ?? []);
    });
    if (outcome.denied) throw new Error(`${name}.${method}: ${outcome.denied}`);
    if (!outcome.reachedDatabase) unreached.push(`${name}.${method}`);
  });

  it("reports the calls that never reached PostgreSQL", () => {
    console.info(`not proven (${unreached.length} of ${calls.length}):\n${unreached.join("\n")}`);
  });
});
