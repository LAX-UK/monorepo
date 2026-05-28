import type { BreadcrumbItem } from "@/components/dashboard/primitives/breadcrumbs";

export type MobileShellTitleModel = {
  title: string;
  /** When set, show a back chevron linking to this href. */
  backHref?: string;
  backLabel?: string;
  /** Optional muted parent label above the title on nested routes. */
  eyebrow?: string;
  /** Secondary line under the title (e.g. acting entity + subkind on overview). */
  contextLine?: string;
  /** Overview identity block vs standard route title. */
  variant?: "route" | "identity";
  /** When true, user is acting on behalf of an organisation. */
  orgActing?: boolean;
};

/** Maps a breadcrumb trail to a mobile shell title model. */
export function resolveMobileShellTitle(items: readonly BreadcrumbItem[]): MobileShellTitleModel {
  if (items.length === 0) {
    return { title: "Dashboard" };
  }

  const last = items[items.length - 1];
  const title = last?.label ?? "Dashboard";

  if (items.length === 1) {
    return { title };
  }

  const currentHasHref = Boolean(last?.href);
  const penultimate = items.length >= 2 ? items[items.length - 2] : undefined;

  if (items.length === 2) {
    const root = items[0];
    const isSectionRoot = root?.href && !currentHasHref && root.label !== title;
    if (isSectionRoot) {
      return { title };
    }
  }

  if (penultimate?.href) {
    const model: MobileShellTitleModel = {
      title,
      backHref: penultimate.href,
      backLabel: penultimate.label,
    };
    if (penultimate.label !== title) {
      model.eyebrow = penultimate.label;
    }
    return model;
  }

  if (items.length >= 3) {
    const parent = items[items.length - 2];
    const grandparent = items[items.length - 3];
    if (grandparent?.href) {
      const model: MobileShellTitleModel = {
        title,
        backHref: grandparent.href,
        backLabel: grandparent.label,
      };
      if (parent?.label && parent.label !== title) {
        model.eyebrow = parent.label;
      }
      return model;
    }
  }

  return { title };
}
