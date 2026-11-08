import type { SessionUser } from "@/lib/data/contracts";
import type { AccountButtonView } from "@/lib/navigation/account-button.vm";
import { cn } from "@auction/ui";
import { ChevronDown } from "lucide-react";
import { AccountButtonMark } from "./account-button-mark";

type Props = {
  view: AccountButtonView;
  user: Pick<SessionUser, "name" | "email" | "image">;
  /** The header sits on a dark hero, so the second line and chevron take the button's own colour. */
  onDark?: boolean;
  /** The menu the button opens is open: the chevron turns. */
  open?: boolean;
};

/**
 * What the desktop account button shows for the account in use: the tile or avatar, then two
 * lines ("Northbank Gallery", "Oliver Grant · Owner"; "Oliver Grant", "Personal") and a chevron.
 * The lines drop away below 1024px, where the header has room for the mark alone.
 */
export function DesktopAccountFace({ view, user, onDark = false, open = false }: Props) {
  const quiet = onDark ? "text-current" : "text-lax-muted";
  return (
    <>
      <AccountButtonMark view={view} user={user} />
      <span className="hidden min-w-0 max-w-[14rem] text-left leading-tight lg:block">
        <span className="block truncate text-lax-14 font-semibold">{view.title}</span>
        <span className={cn("block truncate text-lax-12 font-normal", quiet)}>{view.caption}</span>
      </span>
      <ChevronDown
        aria-hidden
        className={cn(
          "size-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none",
          quiet,
          open && "rotate-180",
        )}
      />
    </>
  );
}
