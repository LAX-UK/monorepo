import { getAdminAuctionList } from "@/lib/data/http/admin.server";
import { DisplayHeading } from "@/components/ui/typography";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import type { AuctionStatus } from "@auction/types";
import Link from "next/link";

const statuses: (AuctionStatus | "all")[] = [
  "all",
  "draft",
  "scheduled",
  "active",
  "ended",
  "cancelled",
];

export default async function AdminAuctionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const statusFilter = sp.status === "all" || !sp.status ? undefined : (sp.status as AuctionStatus);
  const error = sp.error ? decodeURIComponent(sp.error) : null;

  let rows: Awaited<ReturnType<typeof getAdminAuctionList>> = [];
  let listError: string | null = null;
  try {
    rows = await getAdminAuctionList({ limit: 100, offset: 0, ...(statusFilter ? { status: statusFilter } : {}) });
  } catch (e) {
    listError = e instanceof Error ? e.message : "Could not load auctions.";
  }

  return (
    <div className="max-w-6xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <DisplayHeading as="h1" className="text-4xl">
          Auctions
        </DisplayHeading>
        <Link
          href="/admin/auctions/new"
          className="inline-flex w-fit items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary-container px-8 py-3 font-label text-xs font-semibold uppercase tracking-[0.3em] text-on-primary shadow-sm hover:opacity-95"
        >
          New auction
        </Link>
      </div>

      {(error || listError) && (
        <div className="rounded-lg border border-error/30 bg-error/10 px-4 py-3 font-body text-sm text-error" role="alert">
          {listError ?? error}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {statuses.map((s) => {
          const href = s === "all" ? "/admin/auctions" : `/admin/auctions?status=${s}`;
          const active = (s === "all" && !sp.status) || sp.status === s;
          return (
            <Link
              key={s}
              href={href}
              className={`rounded-full px-4 py-2 font-label text-xs uppercase tracking-widest ring-1 transition-colors ${
                active
                  ? "bg-primary text-on-primary ring-primary"
                  : "bg-surface-container-low text-on-surface ring-outline-variant/20 hover:bg-surface-container-high/80"
              }`}
            >
              {s}
            </Link>
          );
        })}
      </div>

      {rows.length === 0 && !listError ? (
        <p className="text-on-surface-variant">No auctions match this filter.</p>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Title</TableHeaderCell>
              <TableHeaderCell>Type</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Ends</TableHeaderCell>
              <TableHeaderCell className="text-right">Hammer</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <Link href={`/admin/auctions/${a.id}`} className="font-medium text-primary hover:underline">
                    {a.title}
                  </Link>
                </TableCell>
                <TableCell className="text-on-surface-variant">{a.auctionType}</TableCell>
                <TableCell>{a.status}</TableCell>
                <TableCell className="text-on-surface-variant text-xs">
                  {a.endTime.toISOString().slice(0, 16).replace("T", " ")}
                </TableCell>
                <TableCell className="text-right tabular-nums">{a.currentPrice}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
