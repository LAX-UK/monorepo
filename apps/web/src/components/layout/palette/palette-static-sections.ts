import {
  readPalettePinned,
  readPaletteRecents,
} from "@/components/layout/palette/palette-cookie-client";
import { buildSuggestedSection } from "@/components/layout/palette/palette-suggested";
import { buildActionPaletteItems } from "@/components/layout/palette/sources/actions-source";
import {
  buildNavPaletteSections,
  buildQuickActionsSection,
} from "@/components/layout/palette/sources/nav-source";
import type { PaletteSection } from "@/components/layout/palette/types";
import type { SessionUser } from "@/lib/data/contracts";
import type { AdminNavCounts } from "@/lib/data/http/admin-nav-counts.types";
import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import type { ShellRole } from "@/lib/shell/contracts";
import type { ClientWorkspaceMode } from "@/lib/workspace/client-workspace-mode";

type BuildStaticSectionsInput = {
  variant: "marketing" | "dashboard" | "admin";
  query: string;
  sessionUser: SessionUser | null;
  shellRole: ShellRole;
  clientWorkspaceMode: ClientWorkspaceMode;
  pendingSubmissionCount: number;
  pendingArtistCount: number;
  navCounts: AdminNavCounts;
};

export function buildStaticPaletteSections(input: BuildStaticSectionsInput): PaletteSection[] {
  const q = input.query.trim();
  const nav = buildNavPaletteSections(
    input.variant,
    input.query,
    input.sessionUser,
    input.clientWorkspaceMode,
    input.pendingSubmissionCount,
    input.pendingArtistCount,
    true,
    input.navCounts,
  );

  const sections: PaletteSection[] = [];

  if (!q && input.variant === "admin" && input.sessionUser) {
    const suggested = buildSuggestedSection({
      shellRole: input.shellRole,
      navSections: nav,
      navCounts: input.navCounts,
      pendingSubmissionCount: input.pendingSubmissionCount,
    });
    if (suggested) sections.push(suggested);
  }

  if (!q) {
    const pinned = readPalettePinned().map((entry) => ({
      id: `pinned-${entry.kind}-${entry.id}`,
      href: entry.href,
      label: entry.label,
      hint: "Pinned",
      kind: "recent" as const,
    }));
    if (pinned.length > 0) {
      sections.push({ id: "pinned", heading: "Pinned", items: pinned });
    }

    const recents = readPaletteRecents().map((entry) => ({
      id: `recent-${entry.kind}-${entry.id}`,
      href: entry.href,
      label: entry.label,
      hint: "Recent",
      kind: "recent" as const,
    }));
    if (recents.length > 0) {
      sections.push({ id: "recents", heading: "Recents", items: recents });
    }
  }

  sections.push(...nav);

  if (!q && input.variant === "admin" && input.sessionUser) {
    sections.push(
      buildQuickActionsSection(input.sessionUser, input.shellRole, input.pendingArtistCount),
    );
  }

  const actions = buildActionPaletteItems(input.query, input.variant, input.sessionUser).map(
    (item) => ({ ...item, kind: "action" as const }),
  );
  if (actions.length > 0) {
    sections.push({ id: "actions", heading: "Actions", items: actions });
  }

  return sections;
}

export function defaultPaletteNavCounts(): AdminNavCounts {
  return EMPTY_ADMIN_NAV_COUNTS;
}
