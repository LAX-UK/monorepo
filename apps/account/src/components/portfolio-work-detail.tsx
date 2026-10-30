import { Button } from "@/components/account-button";
import { formatDate, formatMinorUnits } from "@/lib/format-money";
import type { WorkDetailVm } from "@/server/domain/portfolio-work-detail.vm";
import { EmptyState } from "@auction/ui/components/empty-state";
import { StatusBadge } from "@auction/ui/components/status-badge";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@auction/ui/components/table";
import { CARD, CARD_PADDING, CARD_TITLE } from "./account-ui";
import { CurrencyAmounts, WorkThumbnail } from "./portfolio-parts";
import { ProductText } from "./product-name";

function Section({
  id,
  heading,
  children,
}: {
  id: string;
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-heading`}
      className={`flex flex-col gap-4 ${CARD} ${CARD_PADDING}`}
    >
      <h2 id={`${id}-heading`} className={CARD_TITLE}>
        {heading}
      </h2>
      {children}
    </section>
  );
}

function AcquisitionRecord({ work }: { work: WorkDetailVm }) {
  const amountHeading = work.costsAreDue ? "Amount due" : "Amount paid";
  return (
    <Section id="acquisition" heading="Acquisition record">
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-on-surface-variant">Acquired</dt>
        <dd>{formatDate(work.acquiredAt)}</dd>
        <dt className="text-on-surface-variant">Product</dt>
        <dd>
          <ProductText text={work.productLabel} />
        </dd>
        <dt className="text-on-surface-variant">Seller business</dt>
        <dd>{work.businessName}</dd>
      </dl>
      {work.costLines.length === 0 ? (
        <EmptyState
          variant="plain"
          size="compact"
          headingLevel="h3"
          illustration="ledger"
          title="No cost lines have been recorded for this work yet"
        />
      ) : (
        <Table>
          <TableCaption className="sr-only">
            What this work cost, line by line, each in the currency it was charged in.
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Cost</TableHead>
              <TableHead scope="col" className="text-right">
                {amountHeading}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {work.costLines.map((line) => (
              <TableRow key={line.key}>
                <TableCell>{line.label}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMinorUnits(line.amount, line.currency)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>Total, shipping not included</TableCell>
              <TableCell className="text-right">
                <CurrencyAmounts totals={work.costBasis} />
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      )}
    </Section>
  );
}

function Documents({ work }: { work: WorkDetailVm }) {
  return (
    <Section id="documents" heading="Documents">
      {work.documents.length === 0 ? (
        <EmptyState
          variant="plain"
          size="compact"
          headingLevel="h3"
          illustration="ledger"
          title="No documents are listed for this work yet"
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border-hairline">
          {work.documents.map((doc) => (
            <li
              key={doc.key}
              className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-2"
            >
              {doc.href ? (
                <a
                  href={doc.href}
                  className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4"
                >
                  {doc.label}
                </a>
              ) : (
                <span className="text-sm font-medium">{doc.label}</span>
              )}
              {doc.note ? (
                <span className="text-xs text-on-surface-variant">Expected. {doc.note}</span>
              ) : (
                <span className="text-xs text-on-surface-variant">Available</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function Actions({ work }: { work: WorkDetailVm }) {
  if (work.actions.length === 0) return null;
  return (
    <Section id="actions" heading="What you can do">
      <ul className="flex flex-wrap gap-3">
        {work.actions.map((action) => (
          <li key={action.key}>
            <Button asChild variant="outline">
              <a href={action.href}>{action.label}</a>
            </Button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-on-surface-variant">
        These open <ProductText text={work.productLabel} />.
      </p>
    </Section>
  );
}

/** One work's acquisition record, documents and next steps, all read from the product that sold it. */
export function PortfolioWorkDetail({ work }: { work: WorkDetailVm }) {
  return (
    <>
      <header className="flex items-start gap-4 sm:gap-6">
        <WorkThumbnail src={work.image} className="size-20 shrink-0 sm:size-28" />
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="font-headline text-3xl font-semibold tracking-tight break-words sm:text-4xl">
            {work.title}
          </h1>
          {work.artist ? <p className="text-sm text-on-surface-variant">{work.artist}</p> : null}
          <StatusBadge tone={work.statusTone}>{work.statusLabel}</StatusBadge>
        </div>
      </header>
      <AcquisitionRecord work={work} />
      <Documents work={work} />
      <Actions work={work} />
      <Section id="value" heading="Value">
        <p className="text-sm text-on-surface-variant">{work.valueNote}</p>
      </Section>
    </>
  );
}
