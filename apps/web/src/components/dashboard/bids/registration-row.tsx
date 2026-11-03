"use client";

import type { RegistrationRowVm } from "@/lib/bid/registrations.vm";
import { RecordRow, RecordRowMedia } from "@auction/ui";
import { ButtonLink, StatusBadge } from "@auction/ui/lax";
import { Gavel } from "lucide-react";
import Link from "next/link";

/** The contact form for a registration question, opened already naming the sale. */
export function registrationContactHref(saleTitle: string): string {
  return `/contact?${new URLSearchParams({ intent: "registration", sale: saleTitle })}`;
}

/**
 * One sale the account asked to bid in: when it is, the paddle, where the request stands and
 * the limit. An approved or waiting sale opens the bids placed in it.
 */
export function RegistrationRow({ row }: { row: RegistrationRowVm }) {
  return (
    <RecordRow
      aria-label={`${row.title}, ${row.status.label}`}
      {...(row.href ? { href: row.href, linkAs: Link } : {})}
      leading={
        <RecordRowMedia className="grid place-items-center text-lax-muted">
          <Gavel aria-hidden className="size-5" strokeWidth={1.5} />
        </RecordRowMedia>
      }
      title={row.title}
      meta={row.meta}
      figures={[{ value: row.figure.value, label: row.figure.label }]}
      aligned
      status={
        <StatusBadge tone={row.status.tone} shape={row.status.shape}>
          {row.status.label}
        </StatusBadge>
      }
      action={
        row.contact ? (
          <ButtonLink
            href={registrationContactHref(row.title)}
            Link={Link}
            size="sm"
            aria-label={`Contact us about ${row.title}`}
          >
            Contact us
          </ButtonLink>
        ) : null
      }
    />
  );
}
