import { CollectSession } from "@/components/collect/collect-session";
import { VisitsList } from "@/components/collect/visits-list";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { AccountLoadError } from "@/components/dashboard/primitives/account-load-error";
import { SetMobileShellTitle } from "@/components/layout/set-mobile-shell-title";
import { ListEmpty } from "@/components/workspace/list-states";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { loadAvailability, loadVisits } from "@/lib/collect/collect-api.server";
import { COLLECT_COPY } from "@/lib/collect/collect-copy";
import { collectHref, parseCollectLink } from "@/lib/collect/collect-links";
import { ACCOUNT_LOAD_ERROR } from "@/lib/dashboard/dashboard-copy";
import { getServerDataContainer } from "@/lib/data/container.server";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { GALLERY_CONTACT } from "@auction/branding";
import { ButtonLink, TextLink, pageTitleClass } from "@auction/ui/lax";
import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Collection" };

type PageProps = {
  searchParams: Promise<{ lots?: string | string[]; booking?: string | string[] }>;
};

function Shell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <DashboardPage>
      <SetMobileShellTitle title="Collection" />
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <TextLink
            href={CLIENT_ROUTES.purchases}
            Link={Link}
            className="w-fit items-center gap-1 text-lax-13 no-underline hover:underline"
          >
            <ChevronLeft aria-hidden className="size-4" />
            Purchases
          </TextLink>
          <div className="min-w-0">
            <h1 className={pageTitleClass} data-page-title="">
              {title}
            </h1>
            {subtitle ? <p className="mt-1 text-lax-14 text-lax-muted">{subtitle}</p> : null}
          </div>
        </div>
        {children}
      </div>
    </DashboardPage>
  );
}

function LoadError() {
  return (
    <DashboardPage>
      <SetMobileShellTitle title="Collection" />
      <AccountLoadError {...ACCOUNT_LOAD_ERROR.collect} headingLevel="h1" />
    </DashboardPage>
  );
}

function BackToPurchases({ title, description }: { title: string; description: string }) {
  return (
    <Shell title={COLLECT_COPY.title}>
      <ListEmpty
        illustration="lock"
        title={title}
        description={description}
        actions={
          <ButtonLink href={CLIENT_ROUTES.purchases} Link={Link} variant="primary">
            Go to purchases
          </ButtonLink>
        }
      />
    </Shell>
  );
}

/**
 * Book a time to collect paid lots, change one, or see the booked visits. The page shows what the
 * server says is on offer; booking sends back exactly what was shown and the server decides.
 */
export default async function CollectRoute({ searchParams }: PageProps) {
  const link = parseCollectLink(await searchParams);
  const returnTo =
    link.kind === "lots"
      ? collectHref(link.ids)
      : link.kind === "change"
        ? `${CLIENT_ROUTES.collect}?booking=${link.bookingId}`
        : CLIENT_ROUTES.collect;
  const user = await requireAuthenticatedUser({ shell: "client", loginNext: returnTo });
  const scope = await (await getServerDataContainer()).buying.scope();
  const organisation = scope.account.kind === "organisation" ? scope.account.name : null;
  const viewOnly =
    scope.account.kind === "organisation" && scope.account.actor.isImpersonation === true;
  const now = new Date();
  const contactEmail = GALLERY_CONTACT.email;

  if (link.kind === "invalid") {
    return (
      <BackToPurchases
        title="We couldn't read that link"
        description={
          link.reason === "too_many"
            ? "A visit holds up to 20 lots. Choose fewer, or book in two visits."
            : "Open your purchases and choose the lots you want to collect."
        }
      />
    );
  }

  if (link.kind === "visits") {
    const visits = await loadVisits();
    if (!visits.ok) return <LoadError />;
    return (
      <Shell title={COLLECT_COPY.visitsTitle} subtitle={COLLECT_COPY.entry.intro}>
        <VisitsList
          visits={visits.value}
          now={now}
          contactEmail={contactEmail}
          readOnly={viewOnly}
        />
      </Shell>
    );
  }

  let visit = null;
  let lotIds: string[];
  if (link.kind === "change") {
    const visits = await loadVisits();
    if (!visits.ok) return <LoadError />;
    visit = visits.value.find((v) => v.id === link.bookingId) ?? null;
    if (!visit || visit.status !== "booked" || !visit.actions.includes("change")) {
      return (
        <Shell title={COLLECT_COPY.changeTitle}>
          <ListEmpty
            illustration="ticket"
            title={visit ? COLLECT_COPY.tooLate.change : "We couldn't find that booking"}
            description={
              visit
                ? COLLECT_COPY.booked.afterCutoff(contactEmail)
                : "It may have been cancelled or already changed. Your collections are listed here."
            }
            actions={
              <ButtonLink href={CLIENT_ROUTES.collect} Link={Link} variant="primary">
                {COLLECT_COPY.visitsTitle}
              </ButtonLink>
            }
          />
        </Shell>
      );
    }
    lotIds = visit.lots.filter((lot) => lot.active).map((lot) => lot.lotId);
  } else {
    lotIds = link.ids;
  }

  const availability = await loadAvailability(lotIds, visit?.id ?? null, visit === null);
  if (!availability.ok) {
    if (availability.failure.kind === "forbidden" || availability.failure.kind === "lot") {
      return (
        <BackToPurchases title="You can't book this" description={availability.failure.message} />
      );
    }
    return <LoadError />;
  }

  return (
    <Shell
      title={visit ? COLLECT_COPY.changeTitle : COLLECT_COPY.title}
      subtitle={`${COLLECT_COPY.where}. Monday to Friday, by appointment.`}
    >
      <CollectSession
        availability={availability.value}
        visit={visit}
        myName={user.name}
        organisation={organisation}
        viewOnly={viewOnly}
        nowIso={now.toISOString()}
        contactEmail={contactEmail}
      />
    </Shell>
  );
}
