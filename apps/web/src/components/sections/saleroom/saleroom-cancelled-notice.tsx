import { MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";
import { ButtonLink, EmptyState } from "@auction/ui/lax";
import Link from "next/link";

type Props = {
  saleTitle: string;
};

/**
 * What a cancelled sale's address answers with, so a link someone was given or a bookmark does
 * not end at a missing page. It says what happened and leads on to the calendar and the results.
 */
export function SaleroomCancelledNotice({ saleTitle }: Props) {
  return (
    <section
      className={cn(
        MARKETING_PAGE_SHELL,
        "pb-[var(--section-spacing)] pt-[calc(var(--header-height)+2rem)]",
      )}
    >
      <p className="mb-2 font-label text-sm text-on-surface-variant">{saleTitle}</p>
      <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest">
        <EmptyState
          illustration="frame"
          title="This sale was cancelled"
          description="This sale will not take place. See what is coming up in the calendar, or look back at recent results."
          actions={
            <>
              <ButtonLink Link={Link} variant="primary" href="/sales">
                View the calendar
              </ButtonLink>
              <ButtonLink Link={Link} variant="secondary" href="/archive">
                See past results
              </ButtonLink>
            </>
          }
        />
      </div>
    </section>
  );
}
