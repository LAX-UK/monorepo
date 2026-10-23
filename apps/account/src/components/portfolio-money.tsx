import { formatCurrencyTotals, formatDate, formatMinorUnits } from "@/lib/format-money";
import { MONEY_SECTION_LABELS, MONEY_STATUS_LABELS } from "@/server/domain/portfolio-labels";
import { hasActiveFilter } from "@/server/domain/portfolio-query";
import { safeDeepLink } from "@/server/domain/safe-deep-link";
import {
  LAX_BUSINESS_KEYS,
  type LaxBusinessKey,
  type LaxMoneyEntryV1,
  MONEY_SECTION_KEYS,
  type MoneyDirectionSectionVm,
  type MoneyFilter,
  type MoneyVm,
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
import { PortfolioFilterForm } from "./portfolio-filter-form";

const BUSINESS_NAMES: Record<LaxBusinessKey, string> = {
  lax_bid: "LAX Bid",
  lax_art: "LAX Art",
};

export const MONEY_SEPARATION_NOTE =
  "Money is shown per business and per currency. What you owe is never netted against what you are owed, and none of it is a valuation of your works.";

function EntryLink({ entry }: { entry: LaxMoneyEntryV1 }) {
  const href = safeDeepLink(entry.href);
  if (!href) return <span className="text-on-surface-variant">No link</span>;
  return (
    <a href={href} className="underline">
      Open in {BUSINESS_NAMES[entry.business.key]}
    </a>
  );
}

function EntryStatus({ entry }: { entry: LaxMoneyEntryV1 }) {
  return (
    <StatusBadge variant={entry.status === "cancelled" ? "danger" : "neutral"}>
      {MONEY_STATUS_LABELS[entry.status]}
    </StatusBadge>
  );
}

function SectionBlock({
  legalName,
  section,
}: {
  legalName: string;
  section: MoneyDirectionSectionVm;
}) {
  const label = MONEY_SECTION_LABELS[section.section];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold">{label}</h3>
        <p className="font-headline text-lg font-semibold tabular-nums">
          {section.subtotals.length > 0
            ? formatCurrencyTotals(section.subtotals)
            : "Nothing counted"}
        </p>
      </div>
      <Table>
        <TableCaption className="sr-only">
          {legalName}: {label.toLowerCase()}, newest first.
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Date</TableHead>
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
          {section.entries.map((entry) => (
            <TableRow key={`${entry.business.key}:${entry.id}`}>
              <TableCell className="whitespace-nowrap">{formatDate(entry.occurredAt)}</TableCell>
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
  );
}

function Groups({ groups }: { groups: MoneyVm["groups"] }) {
  return (
    <>
      {groups.map((group) => (
        <section
          key={group.key}
          aria-labelledby={`money-${group.key}-heading`}
          className="flex flex-col gap-5 rounded-2xl border border-border-hairline bg-surface p-4 sm:p-5"
        >
          <h2 id={`money-${group.key}-heading`} className="font-headline text-lg font-semibold">
            {group.legalName}
          </h2>
          {group.sections.map((section) => (
            <SectionBlock key={section.section} legalName={group.legalName} section={section} />
          ))}
        </section>
      ))}
    </>
  );
}

function Ledger({ ledger }: { ledger: LaxMoneyEntryV1[] }) {
  return (
    <section aria-labelledby="money-ledger-heading" className="flex flex-col gap-3">
      <h2 id="money-ledger-heading" className="font-headline text-lg font-semibold">
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
      <ul className="flex flex-col gap-3 md:hidden" aria-label="Ledger">
        {ledger.map((entry) => (
          <li
            key={`${entry.business.key}:${entry.id}`}
            className="flex flex-col gap-2 rounded-2xl border border-border-hairline bg-surface p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-headline text-lg font-semibold tabular-nums">
                {formatMinorUnits(entry.amount, entry.currency)}
              </p>
              <EntryStatus entry={entry} />
            </div>
            <p className="text-sm">
              {MONEY_SECTION_LABELS[moneySectionOf(entry)]} · {entry.business.legalName}
            </p>
            <p className="text-xs text-on-surface-variant">{formatDate(entry.occurredAt)}</p>
            <p className="text-sm">
              <EntryLink entry={entry} />
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Money by business, then by section, with per-currency subtotals, followed by the ledger and
 * its filters. Nothing here adds sections together or converts a currency.
 */
export function PortfolioMoney({
  vm,
  filter,
  action,
  currencies,
}: {
  vm: MoneyVm;
  filter: MoneyFilter;
  action: string;
  currencies: string[];
}) {
  return (
    <>
      <p className="text-sm text-on-surface-variant">{MONEY_SEPARATION_NOTE}</p>
      <PortfolioFilterForm
        action={action}
        label="Filter your money"
        isFiltered={hasActiveFilter(filter)}
        fields={[
          {
            name: "business",
            label: "Business",
            value: filter.business ?? "",
            options: LAX_BUSINESS_KEYS.map((value) => ({
              value,
              label: BUSINESS_NAMES[value],
            })),
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
        ]}
      />
      {vm.noResults ? (
        <EmptyState
          headingLevel="h2"
          title="No money entries match these filters"
          description="Try a different filter, or clear them to see everything."
          action={
            <a href={action} className="inline-flex min-h-11 items-center underline">
              Clear filters
            </a>
          }
        />
      ) : (
        <>
          <Groups groups={vm.groups} />
          <Ledger ledger={vm.ledger} />
        </>
      )}
    </>
  );
}
