import { ActivityView } from "@/components/organisation-team/activity-view";
import { WorkspaceTabNoAccess } from "@/components/organisation-team/workspace-tab-no-access";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { getServerOrganisationActivity } from "@/lib/data/http/organisation-team.server";
import { teamHref } from "@/lib/navigation/client-routes";
import { requireTeamTab } from "@/lib/navigation/team-tabs";
import {
  activityExportHref,
  activityQueryFor,
  parseActivityFilters,
} from "@/lib/organisation-team/activity-filters";
import { loadTeamMembers, loadTeamScope } from "@/lib/organisation-team/team-data.server";
import { notFound } from "next/navigation";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Team's Activity tab: the organisation's history for owners and admins, kept 12 months. */
export default async function TeamActivityPage({ searchParams }: Props) {
  const user = await requireAuthenticatedUser({
    shell: "client",
    loginNext: teamHref("activity"),
  });
  const scope = await loadTeamScope(user);
  if (!scope) notFound();
  const { acting, actor } = scope;
  const access = requireTeamTab(actor, "activity");
  if (access.kind === "forbidden") {
    return (
      <WorkspaceTabNoAccess
        access={access}
        legalEntityId={acting.id}
        actor={actor}
        userId={user.id}
      />
    );
  }

  const filters = parseActivityFilters(await searchParams);
  const now = new Date();
  const query = activityQueryFor(filters, now);
  const [page, members] = await Promise.all([
    getServerOrganisationActivity(acting.id, query).catch(() => null),
    loadTeamMembers(scope),
  ]);
  const people = members.ok
    ? members.data
        .map((member) => ({ value: member.userId, label: member.user.name }))
        .sort((a, b) => a.label.localeCompare(b.label, "en-GB"))
    : [];
  // A person filtered from a link who has since left still reads as a choice.
  if (filters.person && !people.some((person) => person.value === filters.person)) {
    people.push({ value: filters.person, label: "A former member" });
  }

  return (
    <ActivityView
      legalEntityId={acting.id}
      organisationName={acting.displayName}
      filters={filters}
      people={people}
      page={page}
      query={query}
      exportHref={activityExportHref(filters, now)}
      now={now.toISOString()}
    />
  );
}
