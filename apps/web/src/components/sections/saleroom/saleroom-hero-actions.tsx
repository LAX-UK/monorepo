import { SaleroomFollowToggle } from "@/components/sections/saleroom/saleroom-follow-toggle";

type Props = {
  saleId: string;
  saleHref: string;
  isAuthenticated: boolean;
  initialFollowing: boolean;
};

/** Sale Follow action — the Figma hero does not include a registration CTA.
 */
export function SaleroomHeroActions({
  saleId,
  saleHref,
  isAuthenticated,
  initialFollowing,
}: Props) {
  return (
    <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-3 sm:w-auto">
      <SaleroomFollowToggle
        saleId={saleId}
        loginNextPath={saleHref}
        initialFollowing={initialFollowing}
        isAuthenticated={isAuthenticated}
        size="lg"
        appearance="outlined-block"
        label="Follow"
      />
    </div>
  );
}
