import type { UnlinkedOriginal } from "@/lib/data/http/unlinked-originals.server";
import { KeyValueList, Notice, Section, StatusBadge } from "@auction/staff-ui";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

const COUNT = new Intl.NumberFormat("en-GB");

const PRODUCT_LABEL: Record<UnlinkedOriginal["product"], string> = {
  bid: "LAX Bid",
  lax_art: "lax.art",
};

const rowClass =
  "flex min-h-11 flex-col gap-1 px-4 py-2.5 text-staff-sm sm:flex-row sm:items-center sm:gap-3";

function Row({ item }: { item: UnlinkedOriginal }) {
  const opens = item.product === "bid";
  const body = (
    <>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium text-staff-fg">{item.title}</span>
        {item.artistName ? (
          <span className="text-staff-xs text-staff-muted">{item.artistName}</span>
        ) : null}
      </span>
      <span className="flex items-center gap-3">
        <span className="sm:w-20 sm:text-right">
          <StatusBadge tone="neutral">{PRODUCT_LABEL[item.product]}</StatusBadge>
        </span>
        <span className="text-staff-muted sm:w-20">{item.state}</span>
        <ChevronRight
          aria-hidden
          className={`hidden size-4 shrink-0 text-staff-subtle sm:block ${opens ? "" : "invisible"}`}
        />
      </span>
    </>
  );
  // A lot opens its page here; a lax.art artwork is linked in LAX Admin, which this app cannot open.
  return opens ? (
    <Link
      href={`/admin/lots/${encodeURIComponent(item.id)}`}
      className={`${rowClass} staff-focus-inset hover:staff-overlay-hover`}
    >
      {body}
    </Link>
  ) : (
    <div className={rowClass}>{body}</div>
  );
}

/**
 * Every original that is live without a Zoho record, on LAX Bid and on lax.art, so staff can link
 * them before turning both switches on. Reading only: nothing here changes a lot or an artwork.
 */
export function UnlinkedOriginalsList({
  items,
  counts,
}: {
  items: readonly UnlinkedOriginal[];
  counts: { bid: number; laxArt: number };
}) {
  const total = counts.bid + counts.laxArt;
  const shown = items.length;
  return (
    <Section
      title="Live originals with no Zoho record"
      description="Link each one before turning on the switches in LAX Bid and LAX Admin. A lot is replaced by offering the artwork at auction from its Zoho record in LAX Admin; a lax.art artwork is linked from From Zoho in LAX Admin."
    >
      <div className="flex flex-col gap-4">
        <KeyValueList
          items={[
            { label: "On LAX Bid", value: COUNT.format(counts.bid), numeric: true },
            { label: "On lax.art", value: COUNT.format(counts.laxArt), numeric: true },
          ]}
        />
        {total === 0 ? (
          <Notice tone="success" title="Every live original has a Zoho record">
            Nothing needs linking. It is safe to turn the switches on.
          </Notice>
        ) : (
          <ul className="divide-y divide-staff-line-subtle rounded-staff-lg border border-staff-line bg-staff-surface">
            {items.map((item) => (
              <li key={`${item.product}:${item.id}`}>
                <Row item={item} />
              </li>
            ))}
          </ul>
        )}
        {total > shown ? (
          <p className="text-staff-xs text-staff-muted">
            Showing the first {COUNT.format(shown)} of {COUNT.format(total)}. Link some and check
            again.
          </p>
        ) : null}
      </div>
    </Section>
  );
}
