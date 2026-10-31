import type { BiddingRow } from "@/lib/settings/bidding-standing";
import { ButtonLink, StatusBadge } from "@auction/ui/lax";
import Link from "next/link";

function RowValue({ value }: { value: BiddingRow["value"] }) {
  if (value.kind === "badge") return <StatusBadge tone={value.tone}>{value.text}</StatusBadge>;
  if (value.kind === "figure") {
    return (
      <span className="text-lax-20 font-semibold tabular-nums text-lax-fg">
        {value.text}
        {value.unit ? (
          <span className="ml-1.5 text-lax-14 font-normal text-lax-muted">{value.unit}</span>
        ) : null}
      </span>
    );
  }
  return <span className="text-lax-16 font-medium text-lax-fg">{value.text}</span>;
}

/**
 * The Bidding card: one row per fact (the check, the limit, who can bid, an agent's
 * authorisation), each with its label, where it stands, a sentence, and at most one action.
 */
export function BiddingCard({ rows }: { rows: readonly BiddingRow[] }) {
  return (
    <ul className="divide-y divide-lax-line-subtle overflow-hidden rounded-lax-card border border-lax-line bg-lax-surface">
      {rows.map((row) => (
        <li
          key={row.id}
          className="grid gap-4 px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:px-6 md:py-5"
        >
          <div className="min-w-0">
            <p className="text-lax-13 text-lax-muted">{row.label}</p>
            <div className="mt-1 flex items-center gap-2">
              <RowValue value={row.value} />
            </div>
            <p className="mt-1 text-lax-13 text-lax-muted">{row.detail}</p>
          </div>
          {row.action ? (
            row.action.style === "button" ? (
              <ButtonLink href={row.action.href} Link={Link} className="max-md:w-full">
                {row.action.label}
              </ButtonLink>
            ) : (
              <Link
                href={row.action.href}
                className="lax-focus rounded-lax-control text-lax-14 font-medium text-lax-fg underline underline-offset-4 hover:decoration-2"
              >
                {row.action.label}
              </Link>
            )
          ) : null}
        </li>
      ))}
    </ul>
  );
}
