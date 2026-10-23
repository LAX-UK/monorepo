import type { SettingsGroupVm } from "@/server/domain/account-settings.vm";
import { MarketingCarouselPreviousIcon, MarketingViewAllChevron } from "@auction/marketing-ui";
import { AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { InsetGroup } from "@auction/ui/components/inset-group";
import { ListRow } from "@auction/ui/components/list-row";

/** Screen title with the Figma back affordance (circle + chevron) on sub-screens. */
export function AccountPageHeader({
  title,
  backHref,
  backLabel = "Back to overview",
}: {
  title: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      {backHref ? (
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="rounded-full border border-border-hairline"
        >
          <a href={backHref} aria-label={backLabel}>
            <MarketingCarouselPreviousIcon />
          </a>
        </Button>
      ) : null}
      <h1 className="font-headline text-xl font-medium text-on-surface">{title}</h1>
    </div>
  );
}

export function SettingsGroup({ group }: { group: SettingsGroupVm }) {
  return (
    <section aria-label={group.label}>
      <InsetGroup label={group.label} {...(group.footer ? { footer: group.footer } : {})}>
        {group.rows.map((row) => (
          <ListRow
            key={row.href}
            title={row.title}
            {...(row.subtitle ? { subtitle: row.subtitle } : {})}
            href={row.href}
            trailing={<MarketingViewAllChevron className="text-on-surface-variant" />}
          />
        ))}
      </InsetGroup>
    </section>
  );
}

/**
 * Title of a notice. The shared alert title is always an h5, which skips levels on these pages
 * and reads as plain text, so this states the level it sits at and gives it weight.
 */
export function NoticeTitle({
  level = 2,
  id,
  children,
}: {
  level?: 2 | 3;
  id?: string;
  children: string;
}) {
  return (
    <AlertTitle aria-level={level} className="font-semibold" {...(id ? { id } : {})}>
      {children}
    </AlertTitle>
  );
}
