import { ORGANISATION_ONLY_PAGES } from "@/lib/organisations/organisation-only-page.vm";
import { OrganisationOnlyOffer } from "./organisation-only-offer";
import { OrganisationPageNoAccess } from "./organisation-page-no-access";

type Props =
  | { reason: "personal"; page: keyof typeof ORGANISATION_ONLY_PAGES }
  | {
      reason: "role";
      organisationName: string;
    };

/**
 * Why an organisation page has nothing to show: the person is using their personal account (and
 * is offered the switch), or their role in the organisation does not include its settings.
 */
export function OrganisationSettingsUnavailable(props: Props) {
  if (props.reason === "personal") {
    return <OrganisationOnlyOffer page={ORGANISATION_ONLY_PAGES[props.page]} />;
  }
  // The access page names the tab tried and who can open it.
  return <OrganisationPageNoAccess />;
}
