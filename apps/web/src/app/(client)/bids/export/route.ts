import { groupMyBids, parseMyBidTab } from "@/lib/bid/my-bid-status";
import { myBidsCsv, myBidsCsvFilename } from "@/lib/bid/my-bids-csv";
import { getServerDataContainer } from "@/lib/data/container.server";
import { resolveSaleTitles } from "@/lib/data/sale-titles.server";
import { NextResponse } from "next/server";

/**
 * My bids as a CSV download, one view at a time (`?tab=active|won|lost`). Reads the signed-in
 * person's bids through the same endpoint as the page, so the file matches what they see.
 */
export async function GET(request: Request) {
  const tab = parseMyBidTab(new URL(request.url).searchParams.get("tab"));
  const container = await getServerDataContainer();
  const user = await container.session.getCurrent().catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await container.bids.listMine().catch(() => null);
  if (!rows) return NextResponse.json({ error: "bids_unavailable" }, { status: 502 });

  const entries = groupMyBids(rows, user.id)[tab];
  const saleTitleById = await resolveSaleTitles(entries.map((entry) => entry.row.lot?.saleId));
  return new NextResponse(myBidsCsv(entries, saleTitleById), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${myBidsCsvFilename(tab, new Date())}"`,
      "Cache-Control": "no-store",
    },
  });
}
