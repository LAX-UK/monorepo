import { PRODUCTS, type Product } from "@auction/accounting-domain";
import { parseDailyCallBudget } from "@auction/accounting-zoho-books";
import { LONDON_TIME_ZONE, startOfDay } from "@auction/datetime";
import {
  BACKFILL_DEFAULT_LIMIT,
  type BooksBackfillInput,
} from "../finance/accounting/books-backfill.service.js";
import {
  type ShopHistoryImportInput,
  historyDocumentsPerDay,
} from "../finance/accounting/shop-history-import.service.js";

/** `--key value` and `--flag` options; anything else is refused. */
function options(argv: readonly string[], flags: readonly string[], keys: readonly string[]) {
  const values = new Map<string, string>();
  const set = new Set<string>();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] as string;
    if (arg === "--") continue;
    const name = arg.replace(/^--/, "");
    if (flags.includes(name)) set.add(name);
    else if (keys.includes(name) && argv[i + 1] !== undefined) {
      values.set(name, argv[i + 1] as string);
      i += 1;
    } else throw new Error(`unknown or incomplete option: ${arg}`);
  }
  return { values, set };
}

/** A London calendar day (`2027-01-01`) as its first instant. */
export function londonDayStart(day: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`not a day (YYYY-MM-DD): ${day}`);
  const noon = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(noon.getTime())) throw new Error(`not a day: ${day}`);
  return startOfDay(noon, LONDON_TIME_ZONE);
}

function instant(value: string, name: string): Date {
  const at = /^\d{4}-\d{2}-\d{2}$/.test(value) ? londonDayStart(value) : new Date(value);
  if (Number.isNaN(at.getTime())) throw new Error(`--${name} is not a time: ${value}`);
  return at;
}

function wholeNumber(value: string, name: string): number {
  if (!/^\d+$/.test(value)) throw new Error(`--${name} must be a whole number`);
  return Number(value);
}

/** `books:import-shop-history --before <day> [--since <day>] [--dry-run] [--max-documents N]` */
export function parseImportArgs(
  argv: readonly string[],
  env: { readonly ZOHO_BOOKS_DAILY_CALL_BUDGET?: string | undefined },
): ShopHistoryImportInput {
  const { values, set } = options(argv, ["dry-run"], ["before", "since", "max-documents"]);
  const before = values.get("before");
  if (!before) throw new Error("--before <YYYY-MM-DD> (the cutover day) is required");
  // The sender's own parser: an invalid value stops the command, it is never guessed at.
  const perDay = historyDocumentsPerDay(parseDailyCallBudget(env));
  const asked = values.get("max-documents");
  // Never more than the import's share of the budget, however much is asked.
  const maxDocuments = asked ? Math.min(wholeNumber(asked, "max-documents"), perDay) : perDay;
  const since = values.get("since");
  return {
    before: londonDayStart(before),
    since: since ? londonDayStart(since) : null,
    dryRun: set.has("dry-run"),
    maxDocuments,
  };
}

/**
 * `books:backfill --product <p> --not-before <t> --from <t> --to <t> [--after <id>] [--limit N]
 * [--dry-run]`
 */
export function parseBackfillArgs(
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>> = {},
): BooksBackfillInput {
  const { values, set } = options(
    argv,
    ["dry-run"],
    ["product", "not-before", "from", "to", "after", "limit"],
  );
  const product = values.get("product");
  if (!product || !(PRODUCTS as readonly string[]).includes(product)) {
    throw new Error(`--product must be one of ${PRODUCTS.join(", ")}`);
  }
  const from = values.get("from");
  const to = values.get("to");
  if (!from || !to) throw new Error("--from and --to are required");
  const notBefore = values.get("not-before");
  if (!notBefore)
    throw new Error("--not-before <cutover> (when the product went live) is required");
  const after = values.get("after");
  const limit = values.get("limit");
  return {
    product: product as Product,
    notBefore: instant(notBefore, "not-before"),
    from: instant(from, "from"),
    to: instant(to, "to"),
    afterId: after ? wholeNumber(after, "after") : null,
    limit: limit ? wholeNumber(limit, "limit") : BACKFILL_DEFAULT_LIMIT,
    // The import's daily share of the Books budget, here the unsent queue a backfill may add to.
    maxUnsent: historyDocumentsPerDay(parseDailyCallBudget(env)),
    dryRun: set.has("dry-run"),
  };
}
