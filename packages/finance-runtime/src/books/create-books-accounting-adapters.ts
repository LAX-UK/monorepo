import type { TargetMode } from "@auction/accounting-domain";
import {
  type AccountingPorts,
  TRANSIENT_REJECTION_PREFIXES,
  createZohoBooksDryRunAdapter,
  parseOrgConfigs,
} from "@auction/accounting-zoho-books";

/** The environment the Books stack reads. Nothing here can turn a write on. */
export interface BooksAccountingEnv {
  /** The per-organisation Books settings, as JSON (`parseOrgConfigs`). Unset: Books is not built. */
  readonly ZOHO_BOOKS_ORG_CONFIG?: string | undefined;
}

/**
 * The Books adapters a sender may use, one per target mode it can serve, and how to tell a passing
 * refusal from a lasting one. A document is only ever handed to the adapter of the mode it was
 * created for; a mode with no adapter here is never claimed.
 */
export interface BooksAccountingAdapters {
  readonly byMode: Readonly<Partial<Record<TargetMode, AccountingPorts>>>;
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
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("ZOHO_BOOKS_ORG_CONFIG is not valid JSON");
  }
  const orgs = parseOrgConfigs(parsed);
  return {
    byMode: { dry_run: createZohoBooksDryRunAdapter({ orgs }) },
    transientErrorPrefixes: TRANSIENT_REJECTION_PREFIXES,
  };
}
