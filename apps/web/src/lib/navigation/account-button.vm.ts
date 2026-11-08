import type { AccountOption } from "./account-switcher-model";

/** What the account button draws for the account in use, on a phone and on a desktop. */
export type AccountButtonView =
  | {
      kind: "organisation";
      /** The organisation's square tile. */
      tileInitials: string;
      /** The person's initials, as a small badge on the tile. */
      badgeInitials: string;
      /** The accessible name of the button. */
      label: string;
      /** The desktop button's two lines: the organisation, then the person and their role. */
      title: string;
      caption: string;
    }
  | {
      kind: "personal";
      /** The person's round avatar, beside the word "Personal". */
      avatarInitials: string;
      text: "Personal";
      label: string;
      /** The desktop button's two lines: the person's name, then "Personal". */
      title: string;
      caption: string;
    };

/**
 * The account button shows the account in use, not only the person: an organisation as its
 * square tile with the person's initials as a badge, the person's own account as a round avatar
 * and the word "Personal". Round is a person, square is an organisation, everywhere.
 */
export function accountButtonView(
  current: Pick<AccountOption, "kind" | "name" | "detail" | "initials">,
  person: { initials: string; name: string },
): AccountButtonView {
  if (current.kind === "organisation") {
    return {
      kind: "organisation",
      tileInitials: current.initials,
      badgeInitials: person.initials,
      label: `Your accounts, acting as ${current.name}`,
      title: current.name,
      caption: `${person.name} · ${current.detail}`,
    };
  }
  return {
    kind: "personal",
    avatarInitials: person.initials,
    text: "Personal",
    label: `Your accounts, ${current.detail}, Personal`,
    title: current.detail,
    caption: "Personal",
  };
}
