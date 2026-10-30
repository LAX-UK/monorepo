import {
  CARD,
  CARD_PADDING,
  CARD_TITLE,
  EMPTY_STATE,
  SECTION_TITLE,
} from "@/components/account-ui";
import type { FilterFieldVm } from "@/lib/filter-query";
import { formatDate, formatMinorUnits } from "@/lib/format-money";
import { MONEY_SECTION_LABELS, MONEY_STATUS_LABELS } from "@/server/domain/portfolio-labels";
import {
  LEDGER_ANCHOR,
  type MoneyPageVm,
  type MoneySummaryCardVm,
} from "@/server/domain/portfolio-money-page.vm";
import { safeDeepLink } from "@/server/domain/safe-deep-link";
import {
  LAX_BUSINESS_KEYS,
  type LaxBusinessKey,
  type LaxMoneyEntryV1,
  MONEY_SECTION_KEYS,
  type MoneyFilter,
  moneySectionOf,
} from "@auction/lax-ecosystem";
import { EmptyState } from "@auction/ui/components/empty-state";
import { StatusBadge } from "@auction/ui/components/status-badge";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@auction/ui/components/table";
import { FilterToolbar } from "./filter-toolbar.client";

const BUSINESS_NAMES: Record<LaxBusinessKey, string> = {
  lax_bid: "LAX Bid",
  lax_art: "lax.art",
};

export const MONEY_SEPARATION_NOTE =
  "Money is shown per business and per currency. What you owe is never netted against what you are owed, and none of it is a valuation of your works.";

function EntryLink({ entry }: { entry: LaxMoneyEntryV1 }) {
  const href = safeDeepLink(entry.href);
  if (!href) return <span className="text-on-surface-variant">No link</span>;
  return (
    <a
      href={href}
      className="inline-flex min-h-11 items-center rounded-sm whitespace-nowrap underline underline-offset-4"
    >
      Open in {BUSINESS_NAMES[entry.business.key]}
    </a>
  );
}

function EntryStatus({ entry }: { entry: LaxMoneyEntryV1 }) {
  return (
    <StatusBadge tone={entry.status === "cancelled" ? "danger" : "neutral"}>
      {MONEY_STATUS_LABELS[entry.status]}
    </StatusBadge>
  );
}

function SummaryCards({ cards }: { cards: MoneySummaryCardVm[] }) {
  return (
    <section aria-label="Totals by business" className="grid gap-4 md:grid-cols-2">
      {cards.map((card) => (
        <article
          key={card.key}
          aria-labelledby={`money-${card.key}-heading`}
          className={`flex flex-col gap-4 ${CARD} ${CARD_PADDING}`}
        >
          <h2 id={`money-${card.key}-heading`} className={CARD_TITLE}>
            {card.legalName}
          </h2>
          <dl className="flex flex-col divide-y divide-border-hairline">
            {card.lines.map((line) => (
              <div
                key={line.section}
                className="flex items-baseline justify-between gap-4 py-2 first:pt-0"
              >
                <dt className="text-sm text-on-surface-variant">{line.label}</dt>
                <dd className="flex flex-col items-end font-headline text-base font-semibold tabular-nums">
                  {line.totals.length > 0 ? (
                    line.totals.map((total) => (
                      <span key={total.currency}>
                        {formatMinorUnits(total.amount, total.currency)}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm font-normal text-on-surface-variant">
                      Nothing counted
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <a
            href={card.ledgerHref}
            className="inline-flex min-h-11 items-center text-sm font-medium underline"
          >
            See {card.legalName} payments in the ledger
          </a>
        </article>
      ))}
    </section>
  );
}

function Ledger({ ledger }: { ledger: LaxMoneyEntryV1[] }) {
  return (
    <section
      id={LEDGER_ANCHOR}
      aria-labelledby="money-ledger-heading"
      className="flex scroll-mt-4 flex-col gap-4"
    >
      <h2 id="money-ledger-heading" className={SECTION_TITLE}>
        Ledger
      </h2>
      <div className="hidden md:block">
        <Table>
          <TableCaption className="sr-only">
            Every money entry from all your LAX products, newest first.
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Date</TableHead>
              <TableHead scope="col">Business</TableHead>
              <TableHead scope="col">Type</TableHead>
              <TableHead scope="col">Status</TableHead>
              <TableHead scope="col" className="text-right">
                Amount
              </TableHead>
              <TableHead scope="col">
                <span className="sr-only">Link</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ledger.map((entry) => (
              <TableRow key={`${entry.business.key}:${entry.id}`}>
                <TableCell className="whitespace-nowrap">{formatDate(entry.occurredAt)}</TableCell>
                <TableCell>{entry.business.legalName}</TableCell>
                <TableCell>{MONEY_SECTION_LABELS[moneySectionOf(entry)]}</TableCell>
                <TableCell>
                  <EntryStatus entry={entry} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMinorUnits(entry.amount, entry.currency)}
                </TableCell>
                <TableCell className="text-right">
                  <EntryLink entry={entry} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="flex flex-col divide-y divide-border-hairline md:hidden" aria-label="Ledger">
        {ledger.map((entry) => (
          <li key={`${entry.business.key}:${entry.id}`} className="flex flex-col gap-0.5 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="font-headline text-base font-semibold tabular-nums">
                {formatMinorUnits(entry.amount, entry.currency)}
              </p>
              <EntryStatus entry={entry} />
            </div>
            <p className="text-sm">
              {MONEY_SECTION_LABELS[moneySectionOf(entry)]} · {entry.business.legalName}
            </p>
            <p className="text-xs text-on-surface-variant">
              {formatDate(entry.occurredAt)} · <EntryLink entry={entry} />
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function toFields(filter: MoneyFilter, currencies: string[]): FilterFieldVm[] {
  return [
    {
      name: "business",
      label: "Business",
      value: filter.business ?? "",
      options: LAX_BUSINESS_KEYS.map((value) => ({ value, label: BUSINESS_NAMES[value] })),
    },
    {
      name: "section",
      label: "Type",
      value: filter.section ?? "",
      options: MONEY_SECTION_KEYS.map((value) => ({
        value,
        label: MONEY_SECTION_LABELS[value],
      })),
    },
    {
      name: "currency",
      label: "Currency",
      value: filter.currency ?? "",
      options: currencies.map((value) => ({ value, label: value })),
    },
  ];
}

/**
 * Totals per business, then the ledger that lists every payment line once. Filters narrow both.
 * Nothing here adds categories together or converts a currency.
 */
export function PortfolioMoney({
  page,
  filter,
  action,
  totalCount,
}: {
  page: MoneyPageVm;
  filter: MoneyFilter;
  action: string;
  /** How many entries exist before any filter, so the count can say "3 of 12". */
  totalCount: number;
}) {
  const { money } = page;
  return (
    <>
      <p className="text-sm text-on-surface-variant">{MONEY_SEPARATION_NOTE}</p>
      <FilterToolbar
        action={action}
        noun="entries"
        fields={toFields(filter, page.currencies)}
        shown={money.ledger.length}
        total={totalCount}
      />
      {money.noResults ? (
        <EmptyState
          illustration="search"
          className={EMPTY_STATE}
          headingLevel="h2"
          title="No money entries match these filters"
          description="Try a different filter, or clear them to see everything."
          action={
            <a href={action} className="inline-flex min-h-11 items-center underline">
              Clear all filters
            </a>
          }
        />
      ) : (
        <>
          <SummaryCards cards={page.summary} />
          <Ledger ledger={money.ledger} />
        </>
      )}
    </>
  );
}
