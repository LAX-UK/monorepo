import { getServerDataContainer } from "@/lib/data/container.server";
import { fetchServerSoldCsv } from "@/lib/data/http/workspace-selling.server";
import { resolveSellerWorkspaceContext } from "@/lib/legal-entity/seller-acting-context.server";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { workspacePageRefusal } from "@/lib/presenters/workspace-access/workspace-access";
import { parseSoldListQuery } from "@/lib/seller/sold-and-payouts-list";
import { loadSoldAndPayouts } from "@/lib/seller/sold-and-payouts.server";
import { payoutsCsv } from "@/lib/seller/sold-and-payouts.vm";
import { NextResponse } from "next/server";

function csv(body: BodyInit | null, name: string) {
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lax-${name}-${day}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Sold & payouts as a CSV download. Sold lots come from the API's own export (one year, or
 * every year); payouts are written from the same rows the page shows. Only members who see the
 * account's money get a file.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = parseSoldListQuery(Object.fromEntries(params.entries()));
  const everything = params.get("scope") === "all";

  const container = await getServerDataContainer();
  const user = await container.session.getCurrent().catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ctx = await resolveSellerWorkspaceContext(user.role, user.staffRoles);
  if (!ctx.sellerEntityId || workspacePageRefusal(CLIENT_ROUTES.payouts, ctx.actor)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (query.view === "sold") {
    const res = await fetchServerSoldCsv(everything ? null : query.year);
    if (!res.ok) return NextResponse.json({ error: "sold_unavailable" }, { status: res.status });
    return csv(res.body, everything || !query.year ? "sold" : `sold-${query.year}`);
  }
  const vm = await loadSoldAndPayouts(ctx.sellerEntityId);
  if (!vm) return NextResponse.json({ error: "payouts_unavailable" }, { status: 502 });
  return csv(payoutsCsv(vm.payouts), "payouts");
}
