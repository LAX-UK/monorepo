import { buyingPageView } from "@/lib/buying/buying-pages";
import { getServerDataContainer } from "@/lib/data/container.server";
import { PURCHASE_TABS } from "@/lib/purchases/purchase-progress";
import { loadPurchaseSources } from "@/lib/purchases/purchase-sources.server";
import { purchasesCsv, purchasesCsvFilename } from "@/lib/purchases/purchases-csv";
import { parsePurchasesListQuery, purchasesInView } from "@/lib/purchases/purchases-list";
import { buildPurchasesVm } from "@/lib/purchases/purchases.vm";
import { inPeriod, periodOf } from "@/lib/workspace/csv";
import { NextResponse } from "next/server";

/**
 * Purchases as a CSV download: the view and filters on screen (`scope=view`) or every purchase
 * (`scope=all`), optionally within a period of win dates. It reads through the same sources as
 * the page, so the file matches what the member sees, and only members who follow purchases get
 * one.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = parsePurchasesListQuery(Object.fromEntries(params.entries()));
  const everything = params.get("scope") === "all";
  const period = periodOf(params.get("from"), params.get("to"));

  const container = await getServerDataContainer();
  const user = await container.session.getCurrent().catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const view = buyingPageView(await container.buying.scope(), "purchases");
  if (view.kind === "forbidden") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const sources = await loadPurchaseSources();
  if (!sources) return NextResponse.json({ error: "purchases_unavailable" }, { status: 502 });

  const vm = buildPurchasesVm(sources);
  const cards = (
    everything
      ? PURCHASE_TABS.flatMap((tab) => vm.cardsByTab[tab])
      : purchasesInView(vm.cardsByTab[query.view], query)
  ).filter((card) => inPeriod(card.wonAt, period));
  return new NextResponse(purchasesCsv(cards), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${purchasesCsvFilename(everything ? "all" : query.view, new Date())}"`,
      "Cache-Control": "no-store",
    },
  });
}
