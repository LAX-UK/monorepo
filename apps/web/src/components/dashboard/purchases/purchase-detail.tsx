import { dashboardCheckoutLotUrl } from "@/lib/dashboard/dashboard-copy";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import type { DeliveryPanelVm } from "@/lib/purchases/purchase-delivery.vm";
import type { PurchaseCardVm } from "@/lib/purchases/purchases.vm";
import { cn } from "@auction/ui";
import { ButtonLink, StatusBadge } from "@auction/ui/lax";
import { ChevronLeft, Download, FileText } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { DeliveryPanel } from "./delivery-panel";

function Panel({
  title,
  children,
  className,
}: { title: string; children: ReactNode; className?: string }) {
  return (
    <section
      aria-label={title}
      className={cn("rounded-lax-card border border-lax-line bg-lax-surface p-5 md:p-6", className)}
    >
      <h2 className="font-lax-display text-lax-18 font-semibold text-lax-fg">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** The steps as a vertical line: done steps filled, the current one ringed. */
function Progress({ card }: { card: PurchaseCardVm }) {
  if (!card.steps) return <p className="text-lax-14 text-lax-fg">{card.statusNote}</p>;
  return (
    <ol className="flex flex-col">
      {card.steps.map((step, index) => {
        const last = index === (card.steps?.length ?? 0) - 1;
        return (
          <li key={step.id} className="relative flex gap-3 pb-5 last:pb-0">
            {last ? null : (
              <span aria-hidden className="absolute top-4 bottom-0 left-[5px] w-px bg-lax-line" />
            )}
            <span
              aria-hidden
              className={cn(
                "relative mt-1 size-[11px] shrink-0 rounded-full border",
                step.progress === "done" && "border-lax-success-dot bg-lax-success-dot",
                step.progress === "current" &&
                  "border-lax-ink bg-lax-ink ring-4 ring-lax-neutral-bg",
                step.progress === "upcoming" && "border-lax-line-strong bg-lax-surface",
              )}
            />
            <div className="min-w-0">
              <p
                className={cn(
                  "text-lax-14",
                  step.progress === "upcoming" ? "text-lax-muted" : "font-medium text-lax-fg",
                )}
              >
                {step.label}
                <span className="sr-only">
                  {step.progress === "done" ? ", done" : step.progress === "current" ? ", now" : ""}
                </span>
              </p>
              {step.progress === "current" && card.statusNote ? (
                <p className="text-lax-13 text-lax-muted">{card.statusNote}</p>
              ) : step.date ? (
                <p className="text-lax-13 text-lax-muted">{step.date}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * A purchase on its own page: the progress, the delivery panel, what was paid and the
 * documents. The one step that needs the reader (pay, or provide documents) sits under the
 * title.
 */
export function PurchaseDetail({
  card,
  subtitle,
  panel,
  shipperEmail,
}: {
  card: PurchaseCardVm;
  subtitle: string;
  /** `null` when the account's delivery state could not be read. */
  panel: DeliveryPanelVm | null;
  shipperEmail: string;
}) {
  const action = card.payable
    ? { label: `Pay ${card.amount}`, href: dashboardCheckoutLotUrl(card.lotId) }
    : card.primaryAction && !(panel && card.state === "choose-delivery")
      ? card.primaryAction
      : null;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href={CLIENT_ROUTES.purchases}
          className="inline-flex w-fit items-center gap-1 text-lax-13 text-lax-muted hover:text-lax-fg"
        >
          <ChevronLeft aria-hidden className="size-3.5" />
          Purchases
        </Link>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h1
              className="font-lax-display text-lax-28 font-semibold text-lax-fg"
              data-page-title=""
            >
              {card.title}
            </h1>
            <p className="mt-1 text-lax-14 text-lax-muted">{subtitle}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <StatusBadge tone={card.badge.tone} shape={card.badge.shape}>
              {card.badge.label}
            </StatusBadge>
            {action ? (
              <ButtonLink href={action.href} Link={Link} variant="primary">
                {action.label}
              </ButtonLink>
            ) : null}
          </div>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Progress">
            <Progress card={card} />
          </Panel>
          {panel ? (
            <Panel title="Delivery">
              <DeliveryPanel lotId={card.lotId} panel={panel} shipperEmail={shipperEmail} />
            </Panel>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Payment">
            <dl className="flex flex-col gap-2 text-lax-14">
              {card.breakdown.map((line) => (
                <div key={line.label} className="flex justify-between gap-4">
                  <dt className="text-lax-muted">{line.label}</dt>
                  <dd className="text-right tabular-nums text-lax-fg">{line.value}</dd>
                </div>
              ))}
              <div className="mt-2 flex justify-between gap-4 border-t border-lax-line pt-3 font-semibold">
                <dt className="text-lax-fg">
                  {card.amountLabel.charAt(0).toUpperCase()}
                  {card.amountLabel.slice(1)}
                </dt>
                <dd className="tabular-nums text-lax-fg">{card.amount}</dd>
              </div>
            </dl>
          </Panel>
          <Panel title="Documents">
            {card.invoiceHref ? (
              <a
                href={card.invoiceHref}
                target="_blank"
                rel="noopener noreferrer"
                className="-mx-2 flex items-center gap-3 rounded-lax-control px-2 py-2 hover:bg-lax-hover lax-focus"
              >
                <span className="grid size-9 place-items-center rounded-lax-control border border-lax-line text-lax-muted">
                  <FileText aria-hidden className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lax-14 font-medium text-lax-fg">Invoice</span>
                  <span className="block text-lax-13 text-lax-muted">PDF</span>
                </span>
                <Download aria-hidden className="size-4 text-lax-muted" />
                <span className="sr-only">Download the invoice</span>
              </a>
            ) : (
              <p className="text-lax-14 text-lax-muted">
                The invoice appears here once it is raised.
              </p>
            )}
          </Panel>
          {card.problemHref ? (
            <Link
              href={card.problemHref}
              className="w-fit text-lax-14 text-lax-fg underline underline-offset-4"
            >
              Report a problem
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
