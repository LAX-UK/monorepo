import { loadSellingPage } from "@/server/application/load-selling";
import { loadSalesSection } from "@/server/application/load-selling-sections";
import { SELLING_ROUTES } from "@/server/domain/selling/selling-routes";
import { parseSalesPeriod, salesStatementCsv } from "@/server/domain/selling/selling-sales.vm";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** The sales statement for the chosen period as a CSV file. */
export async function GET(request: NextRequest) {
  const context = await loadSellingPage("sales");
  if (context.status === "unsigned") {
    const login = new URL("/api/auth/login", request.url);
    login.searchParams.set("returnTo", SELLING_ROUTES.sales);
    return NextResponse.redirect(login, 303);
  }
  if (context.status !== "ok") {
    return new NextResponse("Not available", {
      status: context.status === "forbidden" ? 404 : 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
  const period = parseSalesPeriod(request.nextUrl.searchParams.get("period") ?? undefined);
  const loaded = await loadSalesSection(context.handle, period);
  if (loaded.status === "unavailable") {
    return new NextResponse("LAX Shop didn't answer. Please try again in a moment.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
  const name = `lax-sales-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(salesStatementCsv(loaded.view.rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
