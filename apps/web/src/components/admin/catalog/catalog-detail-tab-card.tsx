import {
  DetailBoardShell,
  type DetailBoardShellProps,
} from "@/components/admin/catalog/detail-board/detail-board-shell";

type Props = Omit<DetailBoardShellProps, "count"> & {
  /** Optional count badge (alias for DetailBoardShell.count) */
  countBadge?: number;
};

/**
 * Card shell for catalog detail tabs.
 * Thin wrapper over entity-agnostic DetailBoardShell.
 */
export function CatalogDetailTabCard({
  title,
  description,
  actions,
  toolbar,
  children,
  footer,
  className,
  countBadge,
}: Props) {
  return (
    <DetailBoardShell
      title={title}
      {...(description ? { description } : {})}
      {...(actions ? { actions } : {})}
      {...(toolbar ? { toolbar } : {})}
      {...(footer ? { footer } : {})}
      {...(className ? { className } : {})}
      {...(countBadge != null ? { count: countBadge } : {})}
    >
      {children}
    </DetailBoardShell>
  );
}
