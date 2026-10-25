import { AccountSection, CARD, EMPTY_STATE, ListCard, ListCardRow } from "@/components/account-ui";
import type { ArtistArtworkVm, ArtistSaleVm } from "@/server/domain/selling/selling-artworks.vm";
import { cn } from "@auction/ui";
import { EmptyState } from "@auction/ui/components/empty-state";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@auction/ui/components/table";
import { CELL, EDGE, MONEY, ROW, SellingStatus, formatPence } from "./selling-parts";

function Amount({ pence }: { pence: number | null }) {
  if (pence === null) {
    return (
      <span className="text-on-surface-variant">
        <span aria-hidden="true">—</span>
        <span className="sr-only">Not recorded</span>
      </span>
    );
  }
  return <>{formatPence(pence)}</>;
}

export function ArtistArtworksList({ artworks }: { artworks: ArtistArtworkVm[] }) {
  return (
    <AccountSection id="artworks" title="Artworks">
      {artworks.length === 0 ? (
        <EmptyState
          illustration="easel"
          className={EMPTY_STATE}
          headingLevel="h3"
          title="No artworks listed yet"
          description="When LAX lists one of your works, it appears here."
        />
      ) : (
        <ListCard>
          {artworks.map((artwork) => (
            <ListCardRow
              key={artwork.artworkId}
              title={artwork.title}
              trailing={<SellingStatus label={artwork.state.label} tone={artwork.state.tone} />}
            />
          ))}
        </ListCard>
      )}
    </AccountSection>
  );
}

/** Every recorded sale of the artist's works, whoever sold it. */
export function ArtistSalesList({ sales }: { sales: ArtistSaleVm[] }) {
  return (
    <AccountSection
      id="artist-sales"
      title="Sales of your work"
      description="Including resales by collectors. What you were paid shows where LAX paid you."
    >
      {sales.length === 0 ? (
        <EmptyState
          illustration="ledger"
          className={EMPTY_STATE}
          headingLevel="h3"
          title="No sales recorded yet"
          description="Each time one of your works sells through LAX, or a sale is recorded, it appears here."
        />
      ) : (
        <>
          <div className={cn(CARD, "hidden overflow-hidden md:block")}>
            <Table>
              <TableCaption className="sr-only">Sales of your work, newest first.</TableCaption>
              <TableHeader>
                <TableRow className={ROW}>
                  <TableHead scope="col" className={cn(EDGE, "h-11")}>
                    Artwork
                  </TableHead>
                  <TableHead scope="col" className={cn(EDGE, "h-11")}>
                    Sold
                  </TableHead>
                  <TableHead scope="col" className={cn(EDGE, "h-11 text-right")}>
                    Sale price
                  </TableHead>
                  <TableHead scope="col" className={cn(EDGE, "h-11 text-right")}>
                    LAX fees
                  </TableHead>
                  <TableHead scope="col" className={cn(EDGE, "h-11 text-right")}>
                    Net to you
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((sale) => (
                  <TableRow key={sale.saleId} className={ROW}>
                    <TableCell className={CELL}>
                      <span className="block font-medium text-on-surface">{sale.title}</span>
                      <span className="block text-xs text-on-surface-variant">
                        {[sale.edition, sale.resaleRoyalty ? "Resale royalty applies" : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </TableCell>
                    <TableCell className={CELL}>
                      <span className="block whitespace-nowrap">
                        {sale.soldOn ?? "Date not recorded"}
                      </span>
                      <span className="block text-xs text-on-surface-variant">{sale.channel}</span>
                    </TableCell>
                    <TableCell className={cn(CELL, MONEY)}>
                      {formatPence(sale.salePricePence)}
                    </TableCell>
                    <TableCell className={cn(CELL, MONEY)}>
                      <Amount pence={sale.feesPence} />
                    </TableCell>
                    <TableCell className={cn(CELL, MONEY, "font-semibold text-on-surface")}>
                      <Amount pence={sale.netPence} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul
            aria-label="Sales of your work"
            className={cn(CARD, "flex flex-col divide-y divide-border-hairline px-4 md:hidden")}
          >
            {sales.map((sale) => (
              <li key={sale.saleId} className="flex flex-col gap-1 py-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 text-sm font-medium break-words text-on-surface">
                    {sale.title}
                  </p>
                  <p className="font-headline text-base font-semibold tabular-nums whitespace-nowrap">
                    {formatPence(sale.salePricePence)}
                  </p>
                </div>
                <p className="text-xs text-on-surface-variant">
                  {[sale.edition, sale.soldOn, sale.channel].filter(Boolean).join(" · ")}
                </p>
                {sale.netPence !== null ? (
                  <p className="text-xs text-on-surface-variant">
                    Net to you <span className="tabular-nums">{formatPence(sale.netPence)}</span>
                  </p>
                ) : null}
                {sale.resaleRoyalty ? (
                  <p className="text-xs text-on-surface-variant">Resale royalty applies</p>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}
    </AccountSection>
  );
}
