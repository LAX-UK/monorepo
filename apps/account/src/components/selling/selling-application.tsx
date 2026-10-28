import { Button } from "@/components/account-button";
import { AccountSection, CARD, CARD_PADDING, EMPTY_STATE } from "@/components/account-ui";
import type { SellingApplicationVm } from "@/server/domain/selling/selling-application.vm";
import { cn } from "@auction/ui";
import { EmptyState } from "@auction/ui/components/empty-state";
import { SellingStatus } from "./selling-parts";

type ApplicationVm = Extract<SellingApplicationVm, { kind: "application" }>;

/** Submitted, in review, decision: where the application is, as three marks on a line. */
function Journey({ stages }: { stages: ApplicationVm["journey"] }) {
  if (stages.length === 0) return null;
  return (
    <ol aria-label="Where your application is" className="grid grid-cols-3">
      {stages.map((stage, index) => (
        <li
          key={stage.id}
          aria-current={stage.current ? "step" : undefined}
          className="flex flex-col gap-2 pr-2"
        >
          <span className="flex items-center">
            <span
              aria-hidden
              className={cn(
                "size-3 shrink-0 rounded-full border-2",
                stage.reached
                  ? "border-product-accent bg-product-accent"
                  : "border-control-border bg-surface",
              )}
            />
            {index < stages.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  "h-px flex-1",
                  stages[index + 1]?.reached ? "bg-product-accent" : "bg-border-hairline",
                )}
              />
            ) : null}
          </span>
          <span
            className={cn(
              "text-sm",
              stage.reached ? "font-medium text-on-surface" : "text-on-surface-variant",
            )}
          >
            {stage.label}
            {stage.reached ? null : <span className="sr-only"> (not yet)</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * The artist's application to join the gallery, as the Selling area shows it: the status badge
 * and reference, where it is, the gallery's question or reason, and the one next step. The form
 * itself lives on lax.art.
 */
export function SellingApplication({ view }: { view: SellingApplicationVm }) {
  if (view.kind === "none") {
    return (
      <EmptyState
        illustration="easel"
        className={EMPTY_STATE}
        headingLevel="h2"
        title="No application yet"
        description="Artists apply to be represented by the gallery on lax.art. Your application shows here once you start it."
        {...(view.applyHref
          ? {
              action: (
                <Button asChild variant="primary">
                  <a href={view.applyHref}>Apply on lax.art</a>
                </Button>
              ),
            }
          : {})}
      />
    );
  }
  return (
    <AccountSection id="artist-application" title="Your application to the gallery">
      <div className={cn(CARD, CARD_PADDING, "flex flex-col gap-6")}>
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            <div className="flex flex-col gap-0.5">
              <dt className="text-sm text-on-surface-variant">Reference</dt>
              <dd className="text-base tabular-nums text-on-surface">{view.reference}</dd>
            </div>
            {view.sentOn ? (
              <div className="flex flex-col gap-0.5">
                <dt className="text-sm text-on-surface-variant">Sent</dt>
                <dd className="text-base text-on-surface">{view.sentOn}</dd>
              </div>
            ) : null}
          </dl>
          <SellingStatus label={view.status.label} tone={view.status.tone} />
        </div>
        <Journey stages={view.journey} />
        {view.message ? (
          <blockquote className="border-l-2 border-product-accent pl-4">
            <p className="text-sm font-medium text-on-surface-variant">{view.message.label}</p>
            <p className="mt-1 whitespace-pre-line text-base text-on-surface">
              {view.message.text}
            </p>
          </blockquote>
        ) : null}
        <p className="max-w-[60ch] text-base text-on-surface">
          {view.next}
          {view.reapplyOn ? ` You can apply again from ${view.reapplyOn}.` : ""}
        </p>
        {view.action ? (
          <div>
            <Button asChild variant={view.action.emphasis === "primary" ? "primary" : "outline"}>
              <a href={view.action.href}>{view.action.label}</a>
            </Button>
          </div>
        ) : null}
      </div>
    </AccountSection>
  );
}
