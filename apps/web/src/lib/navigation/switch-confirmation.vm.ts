import { initials } from "@/components/organisations/initials";
import { roleInSentence } from "@/lib/organisations/role-in-sentence";
import type { LegalEntitySummary } from "@auction/types";

type Account = Pick<LegalEntitySummary, "kind" | "displayName" | "role">;

/** What the "open this link in another account?" page says. */
export type SwitchConfirmation = {
  title: string;
  description: string;
  /** The button that switches ("Continue as Northbank Gallery"). */
  continueLabel: string;
  /** The link that keeps the current account ("Stay as Personal"). */
  stayLabel: string;
  tile: { kind: "personal" | "organisation"; initials: string };
};

function shortName(account: Account): string {
  return account.kind === "individual" ? "Personal" : account.displayName;
}

function inSentence(account: Account): string {
  return account.kind === "individual" ? "your personal account" : account.displayName;
}

/**
 * The confirmation shown when a link from another site would change the account in use. It
 * names both accounts, so the person knows exactly what changes before anything does.
 */
export function buildSwitchConfirmation(input: {
  requested: Account;
  /** The account in use now; `null` when the browser has no usable one yet. */
  current: Account | null;
  personName: string;
}): SwitchConfirmation {
  const { requested, current } = input;
  const target =
    requested.kind === "individual"
      ? "your personal account"
      : `${requested.displayName}, where you're ${roleInSentence(requested.role)}`;
  const using = current ? `You're using LAX Bid as ${inSentence(current)}. ` : "";
  return {
    title: `Open this as ${shortName(requested)}?`,
    description: `${using}The link you followed is for ${target}.`,
    continueLabel: `Continue as ${shortName(requested)}`,
    stayLabel: current ? `Stay as ${shortName(current)}` : "Go to Home",
    tile: {
      kind: requested.kind === "individual" ? "personal" : "organisation",
      initials: initials(
        requested.kind === "individual" ? input.personName : requested.displayName,
      ),
    },
  };
}
