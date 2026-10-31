import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { getServerSessionUser } from "@/lib/data/http/session.reader";
import { X_LEGAL_ENTITY_ID_HEADER } from "@/lib/legal-entity/client-acting-context";
import { loadTeamScope } from "@/lib/organisation-team/team-data.server";
import { entityActorCan } from "@auction/domain";
import { NextResponse } from "next/server";

/**
 * Activity as a CSV download: the filters on screen, every page of them, from the API's own
 * export so the file holds exactly what the list shows. Owners and admins only, like the tab.
 */
export async function GET(request: Request) {
  const user = await getServerSessionUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const scope = await loadTeamScope(user);
  if (!scope || !entityActorCan(scope.actor, "entity.activity.read")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const qs = new URL(request.url).searchParams.toString();
  const res = await authedServerFetch(`/legal-entities/activity/export${qs ? `?${qs}` : ""}`, {
    headers: { [X_LEGAL_ENTITY_ID_HEADER]: scope.acting.id },
    cache: "no-store",
  });
  if (!res.ok) return NextResponse.json({ error: "export_unavailable" }, { status: 502 });
  return new NextResponse(await res.text(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        res.headers.get("Content-Disposition") ??
        'attachment; filename="organisation-activity.csv"',
      "Cache-Control": "no-store",
    },
  });
}
