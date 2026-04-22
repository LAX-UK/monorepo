import { ShareButton } from "@/components/marketing/share-button";
import { SaleroomFollowToggle } from "@/components/sections/saleroom/saleroom-follow-toggle";
import { SaleroomPrintButton } from "@/components/sections/saleroom/saleroom-print-button";
import { Button } from "@auction/ui/components/button";
import { UserCheck } from "lucide-react";
import Link from "next/link";

type Props = {
  saleId: string;
  saleTitle: string;
  shareUrl: string;
  isAuthenticated: boolean;
  initialFollowing: boolean;
  /** Hero CTA — deep-links to register flow or resolves inside logged-in experience. */
  registerHref: string;
  showRegisterCta: boolean;
};

/**
 * Hero action bar — Register, Follow, Share, Print.
 * SRP: composes focused actions; each child owns its own logic.
 * The Register CTA uses shadcn `Button asChild` so the link inherits
 * primary-button styling with keyboard focus rings.
 */
export function SaleroomHeroActions({
  saleId,
  saleTitle,
  shareUrl,
  isAuthenticated,
  initialFollowing,
  registerHref,
  showRegisterCta,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {showRegisterCta ? (
        <Button
          asChild
          className="h-auto min-h-11 rounded-full px-6 py-2.5 font-label text-xs font-bold uppercase tracking-widest"
        >
          <Link href={registerHref}>
            <UserCheck className="size-4" aria-hidden />
            Register to bid
          </Link>
        </Button>
      ) : null}
      <SaleroomFollowToggle
        saleId={saleId}
        initialFollowing={initialFollowing}
        isAuthenticated={isAuthenticated}
        size="lg"
      />
      <ShareButton url={shareUrl} title={saleTitle} className="rounded-full" />
      <SaleroomPrintButton />
    </div>
  );
}
