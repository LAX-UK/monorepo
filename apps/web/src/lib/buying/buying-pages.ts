import type { AccountScope } from "@/lib/account-scope/account-scope";
import { organisationRoleGroupsSentence } from "@/lib/presenters/organisation-role/organisation-role-presentation";
import {
  type BuyingRecordScope,
  type EntityActor,
  accountBidScope,
  accountPurchaseScope,
  entityActorCan,
} from "@auction/domain";
import { legalEntityMemberRoles } from "@auction/types";

export type BuyingPage = "bids" | "purchases";

type PageSpec = {
  label: string;
  /** Whose records the member follows on the page; the API answers with the same rule. */
  scope: (actor: EntityActor) => BuyingRecordScope;
  /** Title and description for each account shape, in the page's own words. */
  personal: { title: string; description: string };
  organisation: (name: string, scope: "all" | "own") => { title: string; description: string };
};

const PAGE_SPECS: Record<BuyingPage, PageSpec> = {
  bids: {
    label: "Bids",
    scope: accountBidScope,
    personal: {
      title: "My bids",
      description: "Your bids in current and past sales. Prices update live.",
    },
    organisation: (name, scope) => ({
      title: "Bids",
      description:
        scope === "all"
          ? `Bids placed for ${name} in current and past sales. Prices update live.`
          : `Your bids for ${name} in current and past sales. Prices update live.`,
    }),
  },
  purchases: {
    label: "Purchases",
    scope: accountPurchaseScope,
    personal: {
      title: "Purchases",
      description: "Lots you have won, from payment to delivery.",
    },
    organisation: (name, scope) => ({
      title: "Purchases",
      description:
        scope === "all"
          ? `Lots won for ${name}, from payment to delivery.`
          : `Lots you have won for ${name}, from payment to delivery.`,
    }),
  },
};

export type BuyingPageView =
  | {
      kind: "open";
      title: string;
      description: string;
      /** The member may bid, so an empty page may point them to the sales. */
      offersSales: boolean;
    }
  | {
      kind: "forbidden";
      /** "Bids", for "You don't have access to Bids". */
      label: string;
      /** "Owners, admins and buyer agents", for "… can open it". */
      openedBy: string;
    };

/**
 * What a buying page shows for the account in use: its title and description, or the access page
 * when the member's role does not follow these records. Personal accounts always open it.
 */
export function buyingPageView(scope: AccountScope, page: BuyingPage): BuyingPageView {
  const spec = PAGE_SPECS[page];
  const { account } = scope;
  if (account.kind === "personal") return { kind: "open", ...spec.personal, offersSales: true };
  const records = spec.scope(account.actor);
  if (!records) {
    return {
      kind: "forbidden",
      label: spec.label,
      openedBy: organisationRoleGroupsSentence(
        legalEntityMemberRoles.filter((role) => spec.scope({ role }) !== null),
      ),
    };
  }
  return {
    kind: "open",
    ...spec.organisation(account.name, records),
    offersSales: entityActorCan(account.actor, "entity.bid.place"),
  };
}
