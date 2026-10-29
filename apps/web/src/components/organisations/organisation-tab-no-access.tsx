import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import type { OrganisationTabAccess } from "@/lib/navigation/organisation-tabs";
import { Button } from "@auction/ui/components/button";
import { EmptyState } from "@auction/ui/components/empty-state";
import Link from "next/link";

type Props = { access: Extract<OrganisationTabAccess, { kind: "forbidden" }> };

/**
 * A tab of the Organisation page the person's role does not open, reached by its address. It
 * names the tab and who can open it, inside the page so the tabs they can use stay in reach.
 */
export function OrganisationTabNoAccess({ access }: Props) {
  return (
    <EmptyState
      size="panel"
      variant="plain"
      headingLevel="h2"
      illustration="lock"
      title={`You don't have access to ${access.label}`}
      description={`${access.openedBy} can open it. Ask one of them if you need something here.`}
      action={
        <Button asChild variant="secondary">
          <Link href={CLIENT_ROUTES.home}>Back to Home</Link>
        </Button>
      }
    />
  );
}
