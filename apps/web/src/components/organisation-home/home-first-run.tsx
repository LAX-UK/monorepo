import type { FirstRunView } from "@/lib/organisation-home/organisation-dashboard-view";
import { LaxIllustration, type LaxIllustrationName } from "@auction/ui/components/lax-illustration";
import { Button, EmptyState } from "@auction/ui/lax";
import Link from "next/link";
import { HomeSection } from "./home-section";

type StartCard = {
  id: string;
  illustration: LaxIllustrationName;
  title: string;
  description: string;
  href: string;
};

type Props = {
  firstRun: FirstRunView;
  organisationName: string;
  /** Payouts are still to set up: a work can be prepared now and sent afterwards. */
  payoutsPending: boolean;
};

function startCards({ firstRun, organisationName, payoutsPending }: Props): StartCard[] {
  const sell = firstRun.actions.find((action) => action.id === "sell");
  return [
    ...(sell
      ? [
          {
            id: "sell",
            illustration: "easel" as const,
            title: sell.label,
            description: payoutsPending
              ? "Tell us about a work and our specialists will review it. You can prepare it now and send it once payouts are set up."
              : "Tell us about a work and our specialists will review it.",
            href: sell.href,
          },
        ]
      : []),
    {
      id: "sales",
      illustration: "gavel",
      title: "Browse upcoming sales",
      description: `Watch lots and register to bid as ${organisationName}.`,
      href: "/sales",
    },
  ];
}

/**
 * Home before anything has happened. The people who run the organisation get "Get started": a
 * card for each first thing to do (the setup itself is in First steps above). Any other member
 * gets one calm empty state in the organisation's words, with their first action if they have one.
 */
export function HomeFirstRun(props: Props) {
  const { firstRun } = props;
  if (firstRun.addressee === "member") {
    return (
      <div className="rounded-lax-card border border-lax-line bg-lax-surface">
        <EmptyState
          illustration="plinth"
          title={firstRun.title}
          description={firstRun.description}
          actions={firstRun.actions.map((action, index) => (
            <Button
              key={action.id}
              asChild
              variant={index === 0 ? "primary" : "secondary"}
              className="h-11 sm:h-lax-control-md"
            >
              <Link href={action.href}>{action.label}</Link>
            </Button>
          ))}
        />
      </div>
    );
  }
  return (
    <HomeSection id="home-get-started" title="Get started">
      <ul aria-labelledby="home-get-started" className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {startCards(props).map((card) => (
          <li key={card.id}>
            <Link
              href={card.href}
              className="grid h-full grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-4 rounded-lax-card border border-lax-line bg-lax-surface p-4 transition-colors duration-150 hover:border-lax-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lax-focus sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-5"
            >
              <span
                aria-hidden
                className="grid h-14 place-items-center rounded-lax-control bg-lax-paper text-lax-fg sm:h-18"
              >
                <LaxIllustration name={card.illustration} size="compact" className="w-16 sm:w-20" />
              </span>
              <span className="min-w-0">
                <span className="block font-lax-display text-lax-16 font-semibold text-lax-fg">
                  {card.title}
                </span>
                <span className="mt-0.5 block text-lax-13 text-pretty text-lax-muted">
                  {card.description}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </HomeSection>
  );
}
