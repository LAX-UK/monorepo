import { AccountSection, CARD, EMPTY_STATE, ListCard } from "@/components/account-ui";
import type {
  EditionRowVm,
  EditionsPageVm,
  RequestHistoryVm,
} from "@/server/domain/selling/selling-editions.vm";
import { cn } from "@auction/ui";
import { EmptyState } from "@auction/ui/components/empty-state";
import { SaleRequestDialog } from "./sale-request-dialog.client";
import { SellingStat, SellingStats, SellingStatus } from "./selling-parts";
import { WithdrawRequestButton } from "./withdraw-request-button.client";

function Count({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex h-full min-w-0 flex-col gap-0.5">
      {/* The label takes the spare height, so figures line up when a label wraps. */}
      <dt className="flex-1 text-xs text-on-surface-variant">{label}</dt>
      <dd
        className={cn(
          "font-headline text-lg tabular-nums",
          strong ? "font-semibold text-on-surface" : "font-medium text-on-surface",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function PendingIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    >
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6.5V10l2.5 1.5" />
    </svg>
  );
}

function EditionRow({ row }: { row: EditionRowVm }) {
  return (
    <li className="flex flex-col gap-4 px-4 py-5 sm:px-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold break-words text-on-surface">{row.title}</h3>
          <p className="mt-0.5 text-xs text-on-surface-variant">
            {row.lastApprovedOn ? `Last approved ${row.lastApprovedOn}` : "Not approved yet"}
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-4 md:w-[26rem] md:shrink-0">
          <Count label="Approved to sell" value={row.approved} />
          <Count label="Sold or reserved" value={row.soldOrReserved} />
          <Count label="Available now" value={row.availableNow} strong />
        </dl>
        <div className="md:w-40 md:shrink-0 md:text-right">
          {row.action ? (
            <SaleRequestDialog
              artworkId={row.artworkId}
              artworkTitle={row.title}
              current={row.action.current}
              max={row.action.max}
              triggerLabel={row.action.label}
            />
          ) : null}
        </div>
      </div>
      {row.pending ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-surface-container-low px-4 py-2">
          <p className="flex flex-1 basis-56 items-start gap-2 py-2.5 text-sm text-on-surface">
            <span className="mt-0.5">
              <PendingIcon />
            </span>
            <span>
              {row.pending.summary}
              {row.pending.note ? (
                <span className="block text-xs text-on-surface-variant">
                  Your note: {row.pending.note}
                </span>
              ) : null}
            </span>
          </p>
          <WithdrawRequestButton requestId={row.pending.requestId} artworkTitle={row.title} />
        </div>
      ) : null}
    </li>
  );
}

function HistoryRow({ row }: { row: RequestHistoryVm }) {
  return (
    <li className="flex flex-col gap-1 px-4 py-4 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-sm font-medium text-on-surface">{row.title}</span>
        <SellingStatus label={row.outcome} tone={row.tone} />
      </div>
      <p className="text-xs text-on-surface-variant">{row.detail}</p>
      {row.declineReason ? (
        <p className="text-sm text-on-surface">Reason from LAX: {row.declineReason}</p>
      ) : null}
      {row.note ? <p className="text-xs text-on-surface-variant">Your note: {row.note}</p> : null}
    </li>
  );
}

/** The person's editions, what they can sell now, and their requests to change it. */
export function SellingEditions({ page }: { page: EditionsPageVm }) {
  if (page.rows.length === 0) {
    return (
      <EmptyState
        illustration="easel"
        className={EMPTY_STATE}
        headingLevel="h2"
        title="No editions to sell yet"
        description="When LAX approves editions of an artwork for you to sell, they appear here with how many you can sell now."
      />
    );
  }
  return (
    <>
      <SellingStats label="Your editions">
        <SellingStat label="Available to sell now" value={String(page.totals.availableNow)} />
        <SellingStat label="Sold or reserved" value={String(page.totals.soldOrReserved)} />
        <SellingStat label="Artworks" value={String(page.totals.artworks)} />
        <SellingStat label="Requests waiting" value={String(page.totals.pendingRequests)} />
      </SellingStats>
      <AccountSection
        id="editions"
        title="By artwork"
        description="Ask for more, or fewer, from an artwork's row. LAX reviews each request."
      >
        <ListCard>
          {page.rows.map((row) => (
            <EditionRow key={row.artworkId} row={row} />
          ))}
        </ListCard>
      </AccountSection>
      {page.history.length > 0 ? (
        <AccountSection id="requests" title="Past requests">
          <ul className={cn(CARD, "divide-y divide-border-hairline overflow-hidden")}>
            {page.history.map((row) => (
              <HistoryRow key={row.requestId} row={row} />
            ))}
          </ul>
        </AccountSection>
      ) : null}
    </>
  );
}
