import { resolveClientRequestPath } from "@/lib/navigation/client-request-path.server";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { ORGANISATION_PAGE_CAPABILITIES } from "@/lib/navigation/organisation-tabs";
import {
  workspacePageAt,
  workspacePageOpenedBy,
} from "@/lib/presenters/workspace-access/workspace-access";
import { WorkspacePageNoAccess } from "./workspace-page-no-access";

/**
 * The Organisation page for a role that opens none of its tabs. It names the tab the person
 * tried ("You don't have access to Payouts") and who can open it, from the capability table; on
 * the page's own address it names Organisation and everyone who can open a tab.
 */
export async function OrganisationPageNoAccess() {
  const pathname =
    (await resolveClientRequestPath()).split(/[?#]/)[0] ?? CLIENT_ROUTES.organisation;
  const tab = pathname === CLIENT_ROUTES.organisation ? null : workspacePageAt(pathname);
  return (
    <WorkspacePageNoAccess
      inPage
      label={tab?.label ?? "Organisation"}
      openedBy={workspacePageOpenedBy(tab?.anyCapability ?? ORGANISATION_PAGE_CAPABILITIES)}
      next={pathname}
    />
  );
}
