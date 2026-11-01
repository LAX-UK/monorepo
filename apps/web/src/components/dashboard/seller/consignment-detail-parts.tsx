import { MediaImage } from "@/components/ui/media-image";
import type { ConsignmentDetailVm } from "@/lib/seller/consignment-detail.vm";
import { AccountProgress } from "@auction/marketing-ui";
import { Button } from "@auction/ui/components/button";
import { ChevronLeft, MessageSquare } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/** The consignment's head: back to Selling, the work's picture, its status, title and medium. */
export function ConsignmentDetailHead({
  vm,
  title,
  status,
  backHref,
  backLabel,
}: {
  vm: ConsignmentDetailVm;
  title: string;
  status: ReactNode;
  backHref: string;
  backLabel: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Link
        href={backHref}
        className="inline-flex w-fit items-center gap-1 font-body text-sm text-on-surface-variant underline-offset-4 hover:text-on-surface hover:underline"
      >
        <ChevronLeft aria-hidden className="size-4" />
        {backLabel}
      </Link>
      <div className="flex items-center gap-5">
        <span className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-surface-container-high md:size-28">
          <MediaImage src={vm.image} alt="" label="Photo to follow" sizes="112px" />
        </span>
        <div className="min-w-0">
          {status}
          <h1 className="mt-2 text-balance font-headline text-[1.625rem] font-semibold leading-[1.15] tracking-[-0.01em] text-on-surface md:text-[2rem]">
            {title}
          </h1>
          {vm.meta ? (
            <p className="mt-1.5 font-body text-base text-on-surface-variant">{vm.meta}</p>
          ) : null}
        </div>
      </div>
      {vm.steps ? (
        <div className="rounded-xl border border-outline-variant/60 bg-surface-container-lowest px-4 py-4 md:px-5">
          <AccountProgress label="Consignment progress" steps={vm.steps} />
        </div>
      ) : null}
    </div>
  );
}

const ASIDE_CARD = "rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-5";

/** "About the work" beside the consignment: the known facts and the way to the full record. */
export function AboutTheWork({ vm }: { vm: ConsignmentDetailVm }) {
  return (
    <section aria-labelledby="about-work-heading" className={ASIDE_CARD}>
      <h2 id="about-work-heading" className="font-headline text-base font-semibold text-on-surface">
        About the work
      </h2>
      <dl className="mt-3 flex flex-col gap-2.5">
        {vm.facts.map((fact) => (
          <div key={fact.label} className="flex justify-between gap-4 font-body text-sm">
            <dt className="text-on-surface-variant">{fact.label}</dt>
            <dd className="text-right text-on-surface">{fact.value}</dd>
          </div>
        ))}
      </dl>
      {vm.listingHref ? (
        <Button variant="secondaryOutline" size="default" asChild className="mt-4 w-full">
          <Link href={vm.listingHref}>View the lot</Link>
        </Button>
      ) : null}
    </section>
  );
}

/** Who to ask: the specialists reply within a working day. */
/** Questions go to the consignment's own messages, where the specialist answers. */
export function AskYourSpecialist({ messagesHref }: { messagesHref: string }) {
  return (
    <section aria-labelledby="specialist-heading" className={ASIDE_CARD}>
      <h2 id="specialist-heading" className="font-headline text-base font-semibold text-on-surface">
        Your specialist
      </h2>
      <p className="mt-2 font-body text-sm text-on-surface-variant">
        Questions about the estimate, the terms or the sale? Our specialists reply within one
        working day.
      </p>
      <Button variant="secondaryOutline" size="default" asChild className="mt-4 w-full">
        <Link href={messagesHref}>
          <MessageSquare aria-hidden />
          Send a message
        </Link>
      </Button>
    </section>
  );
}
