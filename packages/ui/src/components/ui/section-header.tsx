import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils.js";

export type SectionHeaderProps = Omit<HTMLAttributes<HTMLElement>, "title"> & {
  kicker?: ReactNode;
  /** Include your own heading (e.g. `<DisplayHeading as="h2">`) for correct document outline */
  heading: ReactNode;
  /** e.g. a Next.js `<Link>` “View all” control */
  action?: ReactNode;
};

export function SectionHeader({
  kicker,
  heading,
  action,
  className = "",
  ...rest
}: SectionHeaderProps) {
  return (
    <header
      className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}
      {...rest}
    >
      <div className="flex max-w-[1278px] flex-col gap-3">
        {kicker ? <div className="contents">{kicker}</div> : null}
        <div>{heading}</div>
      </div>
      {action ? (
        <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">{action}</div>
      ) : null}
    </header>
  );
}
