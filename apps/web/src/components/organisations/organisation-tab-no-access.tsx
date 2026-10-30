import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import type { SectionTabAccess } from "@/lib/navigation/section-tabs";
import { AccessDeniedState } from "@auction/ui/components/access-denied-state";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

type Props = { access: Extract<SectionTabAccess<string>, { kind: "forbidden" }> };

/**
 * A tab of a workspace page (Organisation, Team) the person's role does not open, reached by its address. It
 * names the tab and who can open it, inside the page so the tabs they can use stay in reach.
 */
export function OrganisationTabNoAccess({ access }: Props) {
  return (
    <AccessDeniedState
      size="panel"
      page={access.label}
      openedBy={access.openedBy}
      actions={
        <Button asChild variant="secondary">
          <Link href={CLIENT_ROUTES.home}>Back to Home</Link>
        </Button>
      }
    />
  );
}
