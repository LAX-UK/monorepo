import { getServerDataContainer } from "@/lib/data/container.server";
import {
  resolveSellerWorkspaceContext,
  sellerCan,
} from "@/lib/legal-entity/seller-acting-context.server";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { workspacePageRefusal } from "@/lib/presenters/workspace-access/workspace-access";
import { collectionCsv } from "@/lib/seller/collection-csv";
import { parseWorksListQuery, worksInView } from "@/lib/seller/collection-works";
import { loadCollectionWorks } from "@/lib/seller/collection.server";
import { sellingAccess } from "@/lib/seller/selling-access.server";
import { inPeriod, periodOf } from "@/lib/workspace/csv";
import { NextResponse } from "next/server";

/**
 * The organisation's works as a CSV: the search on screen (`scope=view`) or every work
 * (`scope=all`), optionally within a period of acquisition dates. What was paid is a column only
 * for members who see money, as on the page.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = parseWorksListQuery(Object.fromEntries(params.entries()));
  const everything = params.get("scope") === "all";
  const period = periodOf(params.get("from"), params.get("to"));

  const container = await getServerDataContainer();
  const user = await container.session.getCurrent().catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ctx = await resolveSellerWorkspaceContext(user.role, user.staffRoles);
  if (
    !ctx.sellingAsOrganisation ||
    !ctx.sellerEntityId ||
    workspacePageRefusal(CLIENT_ROUTES.collection, ctx.actor)
  ) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const works = await loadCollectionWorks({
    organisationId: ctx.sellerEntityId,
    canSell: sellingAccess(ctx).canSell,
  });
  if (!works) return NextResponse.json({ error: "works_unavailable" }, { status: 502 });

  const rows = (everything ? works : worksInView(works, query)).filter((work) =>
    inPeriod(work.at, period),
  );
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(
    collectionCsv(rows, { showPrice: sellerCan(ctx, "entity.finance.read") }),
    {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="lax-works-${day}.csv"`,
        "Cache-Control": "no-store",
      },
    },
  );
}
