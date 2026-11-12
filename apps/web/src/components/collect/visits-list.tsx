import { ListEmpty } from "@/components/workspace/list-states";
import { COLLECT_COPY } from "@/lib/collect/collect-copy";
import { visitCard } from "@/lib/collect/collect-visit.vm";
import { orderVisits } from "@/lib/collect/collect-visit.vm";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import type { CollectionVisitView } from "@auction/types";
import { ButtonLink } from "@auction/ui/lax/button-link";
import Link from "next/link";
import { VisitCard } from "./visit-card";

/** The account's collection visits: those to come first, then the earlier ones. */
export function VisitsList({
  visits,
  now,
  contactEmail,
  readOnly,
}: {
  visits: readonly CollectionVisitView[];
  now: Date;
  contactEmail: string;
  readOnly: boolean;
}) {
  if (visits.length === 0) {
    return (
      <ListEmpty
        illustration="parcel"
        title={COLLECT_COPY.list.empty}
        description={COLLECT_COPY.list.emptyBody}
        actions={
          <ButtonLink href={CLIENT_ROUTES.purchases} Link={Link} variant="primary">
            Go to purchases
          </ButtonLink>
        }
      />
    );
  }
  const { upcoming, earlier } = orderVisits(visits, now);
  const draw = (visit: CollectionVisitView) => (
    <li key={visit.id}>
      <VisitCard
        visit={visitCard(visit, { now, contactEmail })}
        version={visit.version}
        readOnly={readOnly}
        headingLevel="h3"
      />
    </li>
  );
  return (
    <div className="flex flex-col gap-8">
      {upcoming.length > 0 ? (
        <section aria-label={COLLECT_COPY.list.upcoming} className="flex flex-col gap-4">
          <h2 className="font-lax-display text-lax-18 font-semibold text-lax-fg">
            {COLLECT_COPY.list.upcoming}
          </h2>
          <ul className="flex flex-col gap-4">{upcoming.map(draw)}</ul>
        </section>
      ) : null}
      {earlier.length > 0 ? (
        <section aria-label={COLLECT_COPY.list.past} className="flex flex-col gap-4">
          <h2 className="font-lax-display text-lax-18 font-semibold text-lax-fg">
            {COLLECT_COPY.list.past}
          </h2>
          <ul className="flex flex-col gap-4">{earlier.map(draw)}</ul>
        </section>
      ) : null}
    </div>
  );
}
