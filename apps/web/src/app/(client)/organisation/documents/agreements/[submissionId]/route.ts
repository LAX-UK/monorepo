import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { getServerSessionUser } from "@/lib/data/http/session.reader";
import { X_LEGAL_ENTITY_ID_HEADER } from "@/lib/legal-entity/client-acting-context";
import { loadTeamScope } from "@/lib/organisation-team/team-data.server";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ submissionId: string }> };

/**
 * One consignment agreement as a PDF, for the Documents library. The API decides who may read
 * it (the account's own consignments only); this passes the file through with the session.
 */
export async function GET(_request: Request, { params }: Params) {
  const user = await getServerSessionUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const scope = await loadTeamScope(user);
  if (!scope) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { submissionId } = await params;
  const res = await authedServerFetch(
    `/legal-entities/consignments/${encodeURIComponent(submissionId)}/agreement.pdf`,
    { headers: { [X_LEGAL_ENTITY_ID_HEADER]: scope.acting.id }, cache: "no-store" },
  );
  if (!res.ok) {
    return NextResponse.json(
      { error: "agreement_unavailable" },
      { status: res.status === 404 ? 404 : 502 },
    );
  }
  return new NextResponse(await res.arrayBuffer(), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition":
        res.headers.get("Content-Disposition") ??
        'attachment; filename="consignment-agreement.pdf"',
      "Cache-Control": "no-store",
    },
  });
}
