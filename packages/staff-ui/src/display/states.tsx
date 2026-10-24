import { CircleAlert, Eye, Inbox, Lock, SearchX } from "lucide-react";
import type * as React from "react";
import { cn } from "../lib/cn.js";

type StateProps = {
  title: string;
  description?: React.ReactNode;
  /** One recovery action: "Clear filters", "Try again", "New lot". */
  action?: React.ReactNode;
  className?: string;
  /** Use h2 when the state replaces a page's main content; h3 inside a section. */
  headingLevel?: "h2" | "h3";
};

function StateFrame({
  icon,
  title,
  description,
  action,
  className,
  headingLevel = "h2",
  tone,
  role,
}: StateProps & { icon: React.ReactNode; tone: "neutral" | "danger"; role?: "alert" }) {
  const Heading = headingLevel;
  return (
    <div
      {...(role ? { role } : {})}
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-10 items-center justify-center rounded-staff-md [&_svg]:size-5",
          tone === "danger"
            ? "bg-staff-danger-bg text-staff-danger-fg"
            : "bg-staff-neutral-bg text-staff-muted",
        )}
      >
        {icon}
      </span>
      <div className="flex max-w-sm flex-col gap-1">
        <Heading className="font-staff text-staff-md font-semibold text-staff-fg">{title}</Heading>
        {description ? <p className="text-staff-sm text-staff-muted">{description}</p> : null}
      </div>
      {action ? <div className="mt-1 flex items-center gap-2">{action}</div> : null}
    </div>
  );
}

/** Nothing here yet: say what will appear and how to make the first one. */
export function EmptyState(props: StateProps) {
  return <StateFrame {...props} icon={<Inbox />} tone="neutral" />;
}

/** Filters matched nothing: say so and offer to clear them. */
export function NoResultsState(props: StateProps) {
  return <StateFrame {...props} icon={<SearchX />} tone="neutral" />;
}

/** Loading failed: say what failed, without jargon, and offer a retry. */
export function ErrorState(props: StateProps) {
  return <StateFrame {...props} icon={<CircleAlert />} tone="danger" role="alert" />;
}

/**
 * The role cannot open this page: names what is locked, the role that can, and who to ask. Not a
 * 404 and not an empty list, so a shared link explains itself.
 */
export function AccessDeniedState({
  resource,
  requiredRole,
  contact = "an admin on your team",
  className,
  headingLevel,
}: {
  /** What is locked: "Payments". */
  resource: string;
  /** Who can open it: "Finance". */
  requiredRole?: string;
  contact?: string;
  className?: string;
  headingLevel?: "h2" | "h3";
}) {
  return (
    <StateFrame
      icon={<Lock />}
      tone="neutral"
      title={`You don’t have access to ${resource}`}
      description={
        requiredRole
          ? `${resource} is open to the ${requiredRole} role. Ask ${contact} if you need it.`
          : `Ask ${contact} if you need it.`
      }
      {...(className ? { className } : {})}
      {...(headingLevel ? { headingLevel } : {})}
    />
  );
}

/** A quiet marker in a page header for roles that can look but not change: "View only · Finance". */
export function ViewOnlyBadge({ role }: { role?: string }) {
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-staff-xs border border-staff-line px-2 text-staff-xs font-medium text-staff-muted">
      <Eye aria-hidden className="size-3.5" strokeWidth={1.75} />
      View only{role ? ` · ${role}` : ""}
    </span>
  );
}

/** A block placeholder with the exact geometry of what will load, so nothing shifts. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("block animate-pulse rounded-staff-xs bg-staff-neutral-bg", className)}
    />
  );
}

/**
 * A titled block on a record page: hairline card, 16px header row with an optional action, then
 * content. The default container for detail pages and panels.
 */
export function Section({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
  id,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section
      {...(id ? { id } : {})}
      {...(headingId ? { "aria-labelledby": headingId } : {})}
      className={cn("rounded-staff-md border border-staff-line bg-staff-surface", className)}
    >
      <header className="flex min-h-12 items-center justify-between gap-3 border-b border-staff-line-subtle px-4 py-2.5">
        <div className="min-w-0">
          <h2
            {...(headingId ? { id: headingId } : {})}
            className="font-staff text-staff-md font-semibold text-staff-fg"
          >
            {title}
          </h2>
          {description ? <p className="text-staff-xs text-staff-muted">{description}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </header>
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}
