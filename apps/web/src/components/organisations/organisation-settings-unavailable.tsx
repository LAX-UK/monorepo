import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { EmptyState } from "@auction/ui/components/empty-state";
import { ButtonLink } from "@auction/ui/lax";
import Link from "next/link";
import { OrganisationPageNoAccess } from "./organisation-page-no-access";

type Props =
  | { reason: "personal" }
  | {
      reason: "role";
      organisationName: string;
    };

/**
 * Why the Organisation page has nothing to show: the person is using their personal account, or
 * their role in the organisation does not include its settings.
 */
export function OrganisationSettingsUnavailable(props: Props) {
  if (props.reason === "personal") {
    return (
      <EmptyState
        size="page"
        variant="plain"
        headingLevel="h1"
        illustration="frame"
        title="Organisation"
        description="These settings belong to an organisation. Switch to one from the account menu to manage it, or register your own."
        action={
          <ButtonLink variant="secondary" Link={Link} href={CLIENT_ROUTES.organisations}>
            Your organisations
          </ButtonLink>
        }
      />
    );
  }
  // The access page names the tab tried and who can open it.
  return <OrganisationPageNoAccess />;
}
