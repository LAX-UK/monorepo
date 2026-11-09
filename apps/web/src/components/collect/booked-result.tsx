import { COLLECT_COPY } from "@/lib/collect/collect-copy";
import { collectHref } from "@/lib/collect/collect-links";
import { visitCard } from "@/lib/collect/collect-visit.vm";
import { formatCollectionWhen } from "@auction/domain";
import type { CollectionVisitView } from "@auction/types";
import { ButtonLink, Notice } from "@auction/ui/lax";
import Link from "next/link";
import { VisitCard } from "./visit-card";

export function BookedResult({
  visit,
  moved,
  now,
  contactEmail,
  viewOnly,
}: {
  visit: CollectionVisitView;
  moved: boolean;
  now: Date;
  contactEmail: string;
  viewOnly: boolean;
}) {
  const card = visitCard(visit, { now, contactEmail });
  const when = formatCollectionWhen(new Date(visit.start), now);
  return (
    <div className="flex flex-col gap-4">
      <Notice
        tone="success"
        title={moved ? COLLECT_COPY.booked.changedNotice(when) : COLLECT_COPY.booked.notice(when)}
      >
        {COLLECT_COPY.booked.emailed}
      </Notice>
      <VisitCard visit={card} version={visit.version} readOnly={viewOnly} />
      <div>
        <ButtonLink href={collectHref([])} Link={Link} variant="secondary">
          {COLLECT_COPY.visitsTitle}
        </ButtonLink>
      </div>
    </div>
  );
}
