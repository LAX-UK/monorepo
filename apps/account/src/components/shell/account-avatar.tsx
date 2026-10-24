import { cn } from "@auction/ui";
import { Avatar, AvatarFallback } from "@auction/ui/components/avatar";
import type { AccountViewer } from "./account-viewer";

/** The person's initials in a ring; a neutral person glyph when there is neither name nor email. */
export function AccountAvatar({
  viewer,
  className,
  textClassName,
}: {
  viewer: Pick<AccountViewer, "initials">;
  className?: string;
  textClassName?: string;
}) {
  return (
    <Avatar className={cn("border border-border-hairline", className)}>
      <AvatarFallback
        className={cn(
          "bg-surface-container font-headline font-semibold text-on-surface",
          textClassName ?? "text-xs",
        )}
      >
        {viewer.initials ?? (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            className="size-1/2"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0" />
          </svg>
        )}
      </AvatarFallback>
    </Avatar>
  );
}
