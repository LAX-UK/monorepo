import { createZohoBooksAdapter } from "../adapter/index.js";
import type { ZohoOrgConfigs } from "../adapter/org-config.js";
import { ZohoBooksClient } from "../client.js";
import type { AccountingSubject } from "./adapter-contract.js";
import { InMemoryAccounting } from "./fake-accounting.js";
import { FakeClock } from "./fake-clock.js";
import { InMemoryTokenStore, RecordingLogger } from "./fakes.js";
import { TEST_REFRESH_TOKEN, testConfig } from "./harness.js";
import { BID_ORG_ID, SHOP_ORG_ID, testOrgConfigs } from "./org-fixtures.js";
import { SimulatedBooks } from "./simulated-books.js";

export interface AdapterHarness extends AccountingSubject {
  readonly books: SimulatedBooks;
  readonly clock: FakeClock;
  readonly orgs: ZohoOrgConfigs;
}

/**
 * The real client and adapter over a simulated Books: no network, a fake clock, an in-memory
 * token store. Both organisations are connected.
 */
export async function createAdapterHarness(): Promise<AdapterHarness> {
  const orgs = testOrgConfigs();
  const books = new SimulatedBooks(orgs);
  const clock = new FakeClock();
  const client = new ZohoBooksClient({
    config: testConfig(),
    transport: books,
    tokenStore: new InMemoryTokenStore(),
    clock,
    logger: new RecordingLogger(),
    random: () => 0.5,
  });
  for (const organizationId of [SHOP_ORG_ID, BID_ORG_ID]) {
    await client.registerRefreshToken(organizationId, TEST_REFRESH_TOKEN);
  }
  return {
    ports: createZohoBooksAdapter({ api: client, orgs }),
    faults: books.faults,
    settle: (call) => clock.settle(call),
    books,
    clock,
    orgs,
  };
}

/** The in-memory fake as a contract subject. */
export function createFakeSubject(): AccountingSubject & { readonly fake: InMemoryAccounting } {
  const fake = new InMemoryAccounting();
  return { ports: fake, faults: fake.faults, settle: (call) => call, fake };
}
