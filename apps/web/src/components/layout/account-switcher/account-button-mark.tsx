import { personInitials } from "@/components/layout/account-menu/person-initials";
import { PersonAvatar } from "@/components/ui/person-avatar";
import type { SessionUser } from "@/lib/data/contracts";
import type { AccountButtonView } from "@/lib/navigation/account-button.vm";
import { AccountTile } from "./account-tile";

type Props = {
  view: AccountButtonView;
  user: Pick<SessionUser, "name" | "email" | "image">;
};

/**
 * What the account button draws for the account in use: an organisation as its square tile with
 * the person's initials as a badge, the person's own account as their round avatar. The phone
 * and desktop buttons share it, so round is a person and square an organisation in both.
 */
export function AccountButtonMark({ view, user }: Props) {
  if (view.kind === "organisation") {
    return (
      <span className="relative inline-flex">
        <AccountTile account={{ kind: "organisation", initials: view.tileInitials }} />
        <span
          aria-hidden
          className="absolute -right-1.5 -bottom-1.5 inline-flex size-5 items-center justify-center rounded-full bg-lax-neutral-bg font-lax text-lax-12 leading-none font-semibold tracking-tight text-lax-fg ring-2 ring-lax-page"
        >
          {view.badgeInitials}
        </span>
      </span>
    );
  }
  return (
    <PersonAvatar
      src={user.image}
      name={user.name.trim() || user.email}
      initials={personInitials(user.name, user.email)}
      className="size-8"
    />
  );
}
