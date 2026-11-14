import { createZohoBooksAdapter } from "../adapter/index.js";
import type { ZohoOrgConfigs } from "../adapter/org-config.js";
import type { ZohoWriteMode } from "../adapter/write-gate.js";
import { InMemoryCallBudget } from "../call-budget.js";
import { ZohoBooksClient } from "../client.js";
import type { AccountingSubject, SubjectOptions } from "./adapter-contract.js";
import { InMemoryAccounting } from "./fake-accounting.js";
import { FakeClock } from "./fake-clock.js";
import { InMemoryTokenStore, RecordingLogger } from "./fakes.js";
import { TEST_REFRESH_TOKEN, testConfig } from "./harness.js";
import { type OrgFixtureOptions, testOrgConfigs } from "./org-fixtures.js";
import { SimulatedBooks } from "./simulated-books.js";

export interface AdapterHarness extends AccountingSubject {
  readonly books: SimulatedBooks;
  readonly clock: FakeClock;
  readonly orgs: ZohoOrgConfigs;
  readonly client: ZohoBooksClient;
  /** The day's budget the client counts every call against (and status shares draw on). */
  readonly budget: InMemoryCallBudget;
}

export interface AdapterHarnessOptions extends SubjectOptions, OrgFixtureOptions {
  /**
   * The adapter's write mode. Default: `test_org` for every configured organisation, because the
   * harness talks to the simulator only. Pass `{ mode: "dry_run" }` to test the default.
   */
  readonly writes?: ZohoWriteMode;
}

/**
 * The real client and adapter over a simulated Books: no network, a fake clock, an in-memory
 * token store. Every configured organisation is connected.
 */
export async function createAdapterHarness(
  options: AdapterHarnessOptions = {},
): Promise<AdapterHarness> {
  const orgs = testOrgConfigs(options);
  const books = new SimulatedBooks(orgs);
  const clock = new FakeClock();
  const config = testConfig();
  const budget = new InMemoryCallBudget(clock, config.dailyCallBudget);
  const client = new ZohoBooksClient({
    config,
    transport: books,
    tokenStore: new InMemoryTokenStore(),
    clock,
    budget,
    logger: new RecordingLogger(),
    random: () => 0.5,
  });
  const organizationIds = Object.values(orgs).map((o) => o?.organizationId as string);
  for (const organizationId of organizationIds) {
    await client.registerRefreshToken(organizationId, TEST_REFRESH_TOKEN);
  }
  const writes = options.writes ?? { mode: "test_org", organizationIds };
  return {
    ports: createZohoBooksAdapter({ api: client, orgs, budget, writes }),
    faults: books.faults,
    settle: (call) => clock.settle(call),
    books,
    clock,
    orgs,
    client,
    budget,
  };
}

/** The in-memory fake as a contract subject. */
export function createFakeSubject(
  options: SubjectOptions = {},
): AccountingSubject & { readonly fake: InMemoryAccounting } {
  const fake = new InMemoryAccounting(
    options.withoutBid ? { orgs: { london_art_exchange: { vatRegistered: false } } } : {},
  );
  return { ports: fake, faults: fake.faults, settle: (call) => call, fake };
}
