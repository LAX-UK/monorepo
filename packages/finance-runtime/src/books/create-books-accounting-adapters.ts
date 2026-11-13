import type { DestinationBinding, TargetMode } from "@auction/accounting-domain";
import {
  type AccountingPorts,
  TRANSIENT_REJECTION_PREFIXES,
  createZohoBooksDryRunAdapter,
  parseBooksDestinationBinding,
  parseOrgConfigs,
} from "@auction/accounting-zoho-books";

/** The environment the Books stack reads. Nothing here can turn a write on. */
export interface BooksAccountingEnv {
  /** The per-organisation Books settings, as JSON (`parseOrgConfigs`). Unset: Books is not built. */
  readonly ZOHO_BOOKS_ORG_CONFIG?: string | undefined;
  /**
   * The Books organisation each writing mode may send each product's documents to, as JSON
   * (`{"test_org":{"bid":"<organisation id>"}}`). Checked against the organisation settings at
   * start-up: a `test_org` id must be a `test` organisation. Unset: nothing is bound, so no
   * document aimed at `test_org` or `live` is ever sent. It enables no write on its own.
   */
  readonly ZOHO_BOOKS_DESTINATIONS?: string | undefined;
}

/**
 * The Books adapters a sender may use, one per target mode it can serve, and how to tell a passing
 * refusal from a lasting one. A document is only ever handed to the adapter of the mode it was
 * created for; a mode with no adapter here is never claimed.
 */
export interface BooksAccountingAdapters {
  readonly byMode: Readonly<Partial<Record<TargetMode, AccountingPorts>>>;
  /** Where each writing mode may send each product's documents; the sender checks every call. */
  readonly destinations: DestinationBinding;
  readonly transientErrorPrefixes: readonly string[];
}

/**
 * Builds the Books side of the accounting stack from the environment. Rehearsal only: the one
 * adapter built is the dry run, which holds no HTTP client, so no setting can make it write to
 * Books. Test-organisation and live adapters are added by a later change, each behind its own
 * write gate bound to that kind of organisation. Without organisation settings nothing is built
 * and the accounting projector and sender do not run.
 *
 * Throws at start-up when the settings are present but incomplete or not JSON, so a broken
 * configuration is found when the worker starts, never on the first invoice.
 */
export function createBooksAccountingAdapters(
  env: BooksAccountingEnv,
): BooksAccountingAdapters | null {
  const raw = env.ZOHO_BOOKS_ORG_CONFIG?.trim();
  if (!raw) return null;
  const orgs = parseOrgConfigs(readJson(raw, "ZOHO_BOOKS_ORG_CONFIG"));
  const bound = env.ZOHO_BOOKS_DESTINATIONS?.trim();
  return {
    byMode: { dry_run: createZohoBooksDryRunAdapter({ orgs }) },
    destinations: parseBooksDestinationBinding(
      bound ? readJson(bound, "ZOHO_BOOKS_DESTINATIONS") : undefined,
      orgs,
    ),
    transientErrorPrefixes: TRANSIENT_REJECTION_PREFIXES,
  };
}

function readJson(raw: string, name: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`${name} is not valid JSON`);
  }
}
