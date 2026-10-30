import { LaxIllustration, type LaxIllustrationName } from "@auction/ui/components/lax-illustration";
import { Eye } from "lucide-react";
import type * as React from "react";
import { cn } from "../lib/cn.js";

type StateProps = {
  title: string;
  description?: React.ReactNode;
  /** One recovery action: "Clear filters", "Try again", "New lot". */
  action?: React.ReactNode;
  className?: string;
  /** Use h2 when the state replaces a page's main content; h3 inside a section. */
  headingLevel?: "h1" | "h2" | "h3";
  /**
   * The drawing from the shared LAX illustration set (the public products use the same set).
   * Each state has a default; pick the object that matches the list ("parcel" for orders).
   */
  illustration?: LaxIllustrationName;
  /** `panel` replaces a list or page; `compact` sits inside a table body or a short section. */
  size?: "panel" | "compact";
};

/**
 * The staff empty state: the public products' layout (drawing, title, one sentence, one action)
 * set denser, on staff tokens.
 */
function StateFrame({
  illustration,
  title,
  description,
  action,
  className,
  headingLevel = "h2",
  size = "panel",
  role,
}: StateProps & { illustration: LaxIllustrationName; role?: "alert" }) {
  const Heading = headingLevel;
  const compact = size === "compact";
  return (
    <div
      {...(role ? { role } : {})}
      data-staff-state={illustration}
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-2 px-4 py-8" : "gap-3 px-6 py-12",
        className,
      )}
    >
      <LaxIllustration
        name={illustration}
        size="compact"
        className={cn("text-staff-muted", compact ? "w-16" : "mb-1 w-24")}
      />
      <div className="flex max-w-sm flex-col gap-1">
        <Heading className="text-balance font-staff-display text-staff-md font-semibold text-staff-fg">
          {title}
        </Heading>
        {description ? (
          <p className="text-pretty font-staff text-staff-sm text-staff-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-1 flex items-center gap-2">{action}</div> : null}
    </div>
  );
}

/** Nothing here yet: say what will appear and how to make the first one. */
export function EmptyState({ illustration = "plinth", ...props }: StateProps) {
  return <StateFrame {...props} illustration={illustration} />;
}

/** Filters matched nothing: say so and offer to clear them. */
export function NoResultsState({ illustration = "search", ...props }: StateProps) {
  return <StateFrame {...props} illustration={illustration} />;
}

/** Loading failed: say what failed, without jargon or blame, and offer a retry. */
export function ErrorState({ illustration = "askew", ...props }: StateProps) {
  return <StateFrame {...props} illustration={illustration} role="alert" />;
}

/** A link or record that does not exist (or no longer does). */
export function NotFoundState({ illustration = "ticket", ...props }: StateProps) {
  return <StateFrame {...props} illustration={illustration} />;
}

/**
 * The role cannot open this page: names what is locked, the role that can, and who to ask. Not a
 * 404 and not an empty list, so a shared link explains itself.
 */
export function AccessDeniedState({
  resource,
  requiredRole,
  requiredRoles,
  contact = "an admin on your team",
  action,
  className,
  headingLevel,
}: {
  /** What is locked: "Payments". */
  resource: string;
  /** Who can open it: "Finance". */
  requiredRole?: string;
  /** Several roles that can open it: ["Catalogue manager", "Operations"]. */
  requiredRoles?: readonly string[];
  contact?: string;
  /** A way on, e.g. back to the person's own overview. */
  action?: React.ReactNode;
  className?: string;
  headingLevel?: "h1" | "h2" | "h3";
}) {
  const roles = requiredRoles?.length ? requiredRoles : requiredRole ? [requiredRole] : [];
  const who =
    roles.length > 0
      ? `${resource} is open to the ${ROLE_LIST.format(roles)} ${roles.length === 1 ? "role" : "roles"}. `
      : "";
  return (
    <StateFrame
      illustration="lock"
      title={`You don’t have access to ${resource}`}
      description={`${who}Ask ${contact} if you need it.`}
      {...(action ? { action } : {})}
      {...(className ? { className } : {})}
      {...(headingLevel ? { headingLevel } : {})}
    />
  );
}

const ROLE_LIST = new Intl.ListFormat("en-GB", { style: "long", type: "conjunction" });

/**
 * A quiet marker in a page header for roles that can look but not change. The role is already
 * shown in the account menu, so the marker says only "View only"; the role stays in its tooltip.
 */
export function ViewOnlyBadge({ role }: { role?: string }) {
  return (
    <span
      {...(role ? { title: `Your role: ${role}` } : {})}
      className="inline-flex h-6 items-center gap-1.5 rounded-staff-xs border border-staff-line px-2 text-staff-xs font-medium text-staff-muted"
    >
      <Eye aria-hidden className="size-3.5" strokeWidth={1.75} />
      View only
    </span>
  );
}

/** A block placeholder with the exact geometry of what will load, so nothing shifts. */
export { Skeleton } from "@auction/ui/lax";

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
      className={cn("rounded-staff-lg border border-staff-line bg-staff-surface", className)}
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
