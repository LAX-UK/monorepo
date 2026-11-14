import type { DestinationBinding, LegalEntity, TargetMode } from "@auction/accounting-domain";
import {
  type AccountingPorts,
  BOOKS_ORGANISATIONS,
  TRANSIENT_REJECTION_PREFIXES,
  createZohoBooksDryRunAdapter,
  parseBooksDestinationBinding,
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
  /** Where each writing mode may send each product's documents; the sender checks every call. */
  readonly destinations: DestinationBinding;
  readonly transientErrorPrefixes: readonly string[];
  /** The Books organisation of each legal entity, from the settings (finance task keys, notices). */
  readonly organisationIds: Readonly<Partial<Record<LegalEntity, string>>>;
}

/**
 * Builds the Books side of the accounting stack from the environment. Rehearsal only: the one
 * adapter built is the dry run, which holds no HTTP client, so no setting can make it write to
 * Books. Test-organisation and live adapters are added by a later change, each behind its own
 * write gate bound to that kind of organisation. Without organisation settings nothing is built
 * and the accounting projector and sender do not run.
 *
 * Throws at start-up when the settings are present but incomplete or not JSON, or disagree with
 * the organisations each mode is bound to, so a broken configuration is found when the worker
 * starts (the whole worker does not start, accounting or not), never on the first invoice.
 */
export function createBooksAccountingAdapters(
  env: BooksAccountingEnv,
  organisations: DestinationBinding = BOOKS_ORGANISATIONS,
): BooksAccountingAdapters | null {
  const raw = env.ZOHO_BOOKS_ORG_CONFIG?.trim();
  if (!raw) return null;
  const orgs = parseOrgConfigs(readJson(raw, "ZOHO_BOOKS_ORG_CONFIG"));
  return {
    byMode: { dry_run: createZohoBooksDryRunAdapter({ orgs }) },
    // The organisation ids per mode live in one place (`BOOKS_ORGANISATIONS`), checked against
    // the organisation settings here; tests pass their own.
    destinations: parseBooksDestinationBinding(organisations, orgs),
    transientErrorPrefixes: TRANSIENT_REJECTION_PREFIXES,
    organisationIds: Object.fromEntries(
      Object.entries(orgs).flatMap(([entity, org]) => (org ? [[entity, org.organizationId]] : [])),
    ),
  };
}

function readJson(raw: string, name: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`${name} is not valid JSON`);
  }
}
