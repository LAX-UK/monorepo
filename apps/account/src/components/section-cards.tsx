import { AccountSection, ListCard, ListCardRow } from "./account-ui";

export type CardLinkItem = { key: string; title: string; description?: string; href: string };

/** A headed list of whole-row links; the launch links to other LAX tools use it. */
export function CardLinkSection({
  id,
  heading,
  items,
  footer,
}: {
  id: string;
  heading: string;
  items: CardLinkItem[];
  footer?: string;
}) {
  return (
    <AccountSection id={id} title={heading}>
      <ListCard>
        {items.map((item) => (
          <ListCardRow
            key={item.key}
            title={item.title}
            {...(item.description ? { subtitle: item.description } : {})}
            href={item.href}
          />
        ))}
      </ListCard>
      {footer ? <p className="text-xs text-on-surface-variant">{footer}</p> : null}
    </AccountSection>
  );
}
