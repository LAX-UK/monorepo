import { SaleroomFollowToggle } from "@/components/sections/saleroom/saleroom-follow-toggle";
import { UserCheck } from "lucide-react";
import Link from "next/link";

type Props = {
  saleId: string;
  isAuthenticated: boolean;
  initialFollowing: boolean;
  registerHref: string;
  showRegisterCta: boolean;
};

const btnClass =
  "box-border inline-flex h-10 min-w-0 items-center justify-center rounded-[4px] border border-brand-800 bg-transparent px-8 font-['DM_Sans',sans-serif] text-base font-semibold leading-6 tracking-[0.8px] text-brand-800 transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800 dark:border-on-surface/80 dark:text-on-surface dark:focus-visible:outline-on-surface";

/**
 * Register to Bid + sale Follow — hero CTAs only (SRP).
 */
export function SaleroomHeroActions({
  saleId,
  isAuthenticated,
  initialFollowing,
  registerHref,
  showRegisterCta,
}: Props) {
  return (
    <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-10 sm:w-auto">
      {showRegisterCta ? (
        <Link href={registerHref} className={btnClass}>
          <UserCheck className="mr-2.5 size-4 shrink-0" aria-hidden />
          Register to Bid
        </Link>
      ) : null}
      <SaleroomFollowToggle
        saleId={saleId}
        initialFollowing={initialFollowing}
        isAuthenticated={isAuthenticated}
        size="lg"
        appearance="outlined-block"
        label="Follow"
      />
    </div>
  );
}
