import { accountHomeLink } from "@/lib/navigation/account-home";
import { CLIENT_ROUTES, withAccount } from "@/lib/navigation/client-routes";
import { type HopHref, hopHref } from "@/lib/navigation/hop-href";

/** A page that exists only inside an organisation, and what to say about it in Personal. */
export type OrganisationOnlyPage = {
  /** The page's name: "Team". */
  title: string;
  /** "belongs" for "Team", "belong" for "Organisation settings". */
  verb: "belongs" | "belong";
  /** Where it lives, so switching opens it in the organisation. */
  path: string;
  /** Finishes "Switch to Northbank Gallery …": "to see its team". */
  purpose: string;
};

/** Each organisation-only page in one table; a new one is one row. */
export const ORGANISATION_ONLY_PAGES = {
  team: { title: "Team", verb: "belongs", path: CLIENT_ROUTES.team, purpose: "to see its team" },
  organisation: {
    title: "Organisation settings",
    verb: "belong",
    path: CLIENT_ROUTES.organisation,
    purpose: "to manage its details",
  },
} as const satisfies Record<string, OrganisationOnlyPage>;

type OrganisationRef = { id: string; name: string };

/** What the page offers: the one way on, then the way back. */
export type OrganisationOnlyView = {
  title: string;
  description: string;
  action: /** One organisation: switch to it and open this page there, in one tap. */
    | { kind: "switch"; label: string; href: HopHref }
    /** Two or more: the account switcher chooses. */
    | { kind: "choose" }
    /** None: the person's organisations page is where one is registered. */
    | { kind: "organisations"; label: string; href: string };
  back: { label: string; href: string };
};

const PERSONAL_NOTE = "You're using your personal account.";

/**
 * What an organisation-only page says to someone using their personal account. It never switches
 * for them: a typed or bookmarked address must not change who they act as without being asked.
 */
export function organisationOnlyView(
  page: OrganisationOnlyPage,
  organisations: readonly OrganisationRef[],
): OrganisationOnlyView {
  const back = accountHomeLink("personal");
  const [only, ...others] = organisations;
  if (only && others.length === 0) {
    return {
      title: `${page.title} ${page.verb} to ${only.name}`,
      description: `${PERSONAL_NOTE} Switch to ${only.name} ${page.purpose}.`,
      action: {
        kind: "switch",
        label: `Switch to ${only.name}`,
        href: hopHref(withAccount(page.path, only.id)),
      },
      back,
    };
  }
  if (only) {
    return {
      title: `${page.title} ${page.verb} to an organisation`,
      description: `${PERSONAL_NOTE} Choose an organisation ${page.purpose}.`,
      action: { kind: "choose" },
      back,
    };
  }
  return {
    title: `${page.title} ${page.verb} to an organisation`,
    description: `${PERSONAL_NOTE} Register an organisation to use this page.`,
    action: {
      kind: "organisations",
      label: "Your organisations",
      href: CLIENT_ROUTES.organisations,
    },
    back,
  };
}
