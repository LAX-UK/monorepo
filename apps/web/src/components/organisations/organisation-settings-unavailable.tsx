import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { Button } from "@auction/ui/components/button";
import { EmptyState } from "@auction/ui/components/empty-state";
import Link from "next/link";

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
        title="Organisation settings"
        description="These settings belong to an organisation. Switch to one from the account menu to manage it, or register your own."
        action={
          <Button asChild variant="secondary">
            <Link href={CLIENT_ROUTES.organisations}>Your organisations</Link>
          </Button>
        }
      />
    );
  }
  return (
    <EmptyState
      size="page"
      variant="plain"
      headingLevel="h1"
      illustration="lock"
      title="Organisation settings"
      description={`Your role at ${props.organisationName} doesn't include its settings. Ask an owner or admin if you need them.`}
    />
  );
}
