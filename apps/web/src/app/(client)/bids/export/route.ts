import { bidMatches, parseBidsListQuery } from "@/lib/bid/bids-list";
import { MY_BID_TABS, type MyBidTab, groupMyBids } from "@/lib/bid/my-bid-status";
import { type CsvBid, myBidsCsv, myBidsCsvFilename } from "@/lib/bid/my-bids-csv";
import { buildMyBidsVm } from "@/lib/bid/my-bids.vm";
import { getServerDataContainer } from "@/lib/data/container.server";
import { resolveSaleTitles } from "@/lib/data/sale-titles.server";
import { accountBidScope } from "@auction/domain";
import { NextResponse } from "next/server";

const DAY_MS = 86_400_000;

/** Whole days as `YYYY-MM-DD`; the end day is included. */
function periodOf(from: string | null, to: string | null): { from: number; to: number } | null {
  const start = from ? Date.parse(`${from}T00:00:00Z`) : Number.NaN;
  const end = to ? Date.parse(`${to}T00:00:00Z`) + DAY_MS : Number.NaN;
  if (Number.isNaN(start) && Number.isNaN(end)) return null;
  return {
    from: Number.isNaN(start) ? Number.NEGATIVE_INFINITY : start,
    to: Number.isNaN(end) ? Number.POSITIVE_INFINITY : end,
  };
}

/**
 * Bids as a CSV download: the view and filters on screen (`scope=view`) or every bid
 * (`scope=all`), optionally within a period of closing dates. Reads the account in use through
 * the same reader as the page, so the file matches what the member sees.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = parseBidsListQuery(Object.fromEntries(params.entries()));
  const everything = params.get("scope") === "all";
  const period = periodOf(params.get("from"), params.get("to"));

  const container = await getServerDataContainer();
  const user = await container.session.getCurrent().catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [rows, scope] = await Promise.all([
    container.buying.bids().catch(() => null),
    container.buying.scope(),
  ]);
  if (!rows) return NextResponse.json({ error: "bids_unavailable" }, { status: 502 });

  const saleTitleById = await resolveSaleTitles(rows.map((row) => row.lot?.saleId));
  const shared =
    scope.account.kind === "organisation" && accountBidScope(scope.account.actor) === "all";
  const vm = buildMyBidsVm({ rows, userId: user.id, showPlacedBy: shared, saleTitleById });
  const groups = groupMyBids(rows, user.id);
  const tabs: readonly MyBidTab[] = everything
    ? MY_BID_TABS
    : [query.view === "sales" ? "active" : query.view];

  const entries: CsvBid[] = [];
  for (const tab of tabs) {
    groups[tab].forEach((entry, index) => {
      const card = vm.cardsByTab[tab][index];
      if (!card) return;
      if (!everything && !bidMatches(card, query)) return;
      if (period && (card.closesAt < period.from || card.closesAt >= period.to)) return;
      entries.push(entry);
    });
  }
  return new NextResponse(myBidsCsv(entries, saleTitleById), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${myBidsCsvFilename(everything ? "all" : (tabs[0] ?? "active"), new Date())}"`,
      "Cache-Control": "no-store",
    },
  });
}
