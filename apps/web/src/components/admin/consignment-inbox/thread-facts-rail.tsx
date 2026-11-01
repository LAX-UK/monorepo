import {
  type ThreadFact,
  clientFacts,
  consignmentFacts,
} from "@/lib/admin/consignment-inbox/thread-facts";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import {
  CellThumbnail,
  KeyValueList,
  RecordImage,
  Section,
  StaffButtonLink,
  type StaffLinkComponent,
  StatusBadge,
  TextLink,
} from "@auction/staff-ui";
import type { ConsignmentThreadDetail } from "@auction/validators";
import { ExternalLink } from "lucide-react";
import Link from "next/link";

const NextLink: StaffLinkComponent = Link;

function value(fact: ThreadFact) {
  const main = fact.stage ? (
    (() => {
      const status = staffStatus("submission", fact.stage);
      return <StatusBadge tone={status.tone}>{status.label}</StatusBadge>;
    })()
  ) : fact.href ? (
    <TextLink href={fact.href} Link={NextLink}>
      {fact.value}
    </TextLink>
  ) : (
    fact.value
  );
  return fact.detail ? (
    <span className="flex flex-col">
      <span>{main}</span>
      <span className="text-staff-sm text-staff-muted">{fact.detail}</span>
    </span>
  ) : (
    main
  );
}

function items(facts: readonly ThreadFact[]) {
  return facts.map((fact) => ({
    label: fact.label,
    value: value(fact),
    ...(fact.copy ? { copyValue: fact.copy } : {}),
  }));
}

/**
 * The consignment and the client beside the thread. On a phone the consignment card comes first,
 * above the thread, so the facts are read before the reply.
 */
export function ThreadFactsRail({ detail }: { detail: ConsignmentThreadDetail }) {
  const client = clientFacts(detail);
  return (
    <>
      <Section
        title="Consignment"
        action={
          <StaffButtonLink
            href={`/admin/submissions/${detail.submission.id}`}
            Link={NextLink}
            variant="ghost"
            size="sm"
            icon={<ExternalLink aria-hidden />}
          >
            Open
          </StaffButtonLink>
        }
      >
        <div className="flex items-center gap-3 pb-3">
          {detail.submission.imageUrl ? (
            <RecordImage
              src={detail.submission.imageUrl}
              alt=""
              className="aspect-square size-14 w-14 shrink-0 object-cover"
            />
          ) : (
            <CellThumbnail src={null} label="No photos yet" />
          )}
          <div className="min-w-0">
            <p className="truncate text-staff-md font-medium text-staff-fg">
              {detail.submission.title}
            </p>
            {detail.facts.artistLine ? (
              <p className="truncate text-staff-sm text-staff-muted">{detail.facts.artistLine}</p>
            ) : null}
          </div>
        </div>
        <KeyValueList items={items(consignmentFacts(detail))} />
      </Section>
      {client.length > 0 ? (
        <Section
          title="Client"
          action={
            detail.account ? (
              <StaffButtonLink
                href={`/admin/legal-entities/${detail.account.id}`}
                Link={NextLink}
                variant="ghost"
                size="sm"
                icon={<ExternalLink aria-hidden />}
              >
                Open
              </StaffButtonLink>
            ) : null
          }
        >
          <KeyValueList items={items(client)} />
        </Section>
      ) : null}
    </>
  );
}
