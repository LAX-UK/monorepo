import { getServerDataContainer } from "@/lib/data/container.server";
import { resolveSellerWorkspaceContext } from "@/lib/legal-entity/seller-acting-context.server";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { workspacePageRefusal } from "@/lib/presenters/workspace-access/workspace-access";
import { consignmentsCsv, consignmentsCsvFilename } from "@/lib/seller/consignments-csv";
import { consignmentsInView, parseConsignmentsListQuery } from "@/lib/seller/consignments-list";
import { loadConsignments } from "@/lib/seller/consignments.server";
import { inPeriod, periodOf } from "@/lib/workspace/csv";
import { NextResponse } from "next/server";

/**
 * Consignments as a CSV download: the view and filters on screen (`scope=view`) or every
 * consignment (`scope=all`), optionally within a period of the dates they were sent. It reads the
 * same sources as the page, so the file matches what the member sees.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = parseConsignmentsListQuery(Object.fromEntries(params.entries()));
  const everything = params.get("scope") === "all";
  const period = periodOf(params.get("from"), params.get("to"));

  const container = await getServerDataContainer();
  const user = await container.session.getCurrent().catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ctx = await resolveSellerWorkspaceContext(user.role, user.staffRoles);
  if (workspacePageRefusal(CLIENT_ROUTES.consignments, ctx.actor)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { records } = await loadConsignments(ctx, user.id);
  if (!records) return NextResponse.json({ error: "consignments_unavailable" }, { status: 502 });

  const rows = (everything ? records : consignmentsInView(records, query)).filter((record) =>
    inPeriod(record.sentAt, period),
  );
  return new NextResponse(consignmentsCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${consignmentsCsvFilename(everything ? "all" : query.view, new Date())}"`,
      "Cache-Control": "no-store",
    },
  });
}
