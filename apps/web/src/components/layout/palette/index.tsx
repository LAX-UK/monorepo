"use client";

import {
  PALETTE_OPEN_EVENT,
  clearPendingPaletteOpen,
  takePendingPaletteOpen,
} from "@/components/layout/command-palette-events";
import { PaletteResults } from "@/components/layout/palette/palette-results";
import { PaletteSearch } from "@/components/layout/palette/palette-search";
import {
  buildStaticPaletteSections,
  defaultPaletteNavCounts,
} from "@/components/layout/palette/palette-static-sections";
import { buildVisiblePaletteSections } from "@/components/layout/palette/palette-visible-sections";
import { artistsPaletteSource } from "@/components/layout/palette/sources/artists-source";
import { clientsPaletteSource } from "@/components/layout/palette/sources/clients-source";
import { conditionReportsPaletteSource } from "@/components/layout/palette/sources/condition-reports-source";
import { invitationsPaletteSource } from "@/components/layout/palette/sources/invitations-source";
import { lotFulfilmentPaletteSource } from "@/components/layout/palette/sources/lot-fulfilment-source";
import { lotsPaletteSource } from "@/components/layout/palette/sources/lots-source";
import { paymentsPaletteSource } from "@/components/layout/palette/sources/payments-source";
import { payoutsPaletteSource } from "@/components/layout/palette/sources/payouts-source";
import { salesPaletteSource } from "@/components/layout/palette/sources/sales-source";
import { submissionsPaletteSource } from "@/components/layout/palette/sources/submissions-source";
import type { PaletteItem } from "@/components/layout/palette/types";
import { useDebouncedPaletteSearch } from "@/components/layout/palette/use-debounced-palette-search";
import type { SessionUser } from "@/lib/data/contracts";
import type { AdminNavCounts } from "@/lib/data/http/admin-nav-counts.types";
import type { ShellRole } from "@/lib/shell/contracts";
import type { ClientWorkspaceMode } from "@/lib/workspace/client-workspace-mode";
import { Command, CommandDialog } from "@auction/ui";
import { cn } from "@auction/ui";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { pushPaletteRecent } from "./palette-cookie-client";

export type { PaletteItem, PaletteSection } from "@/components/layout/palette/types";

const ADMIN_ASYNC_SOURCES = [
  lotsPaletteSource,
  salesPaletteSource,
  clientsPaletteSource,
  paymentsPaletteSource,
  artistsPaletteSource,
  invitationsPaletteSource,
  submissionsPaletteSource,
  conditionReportsPaletteSource,
  lotFulfilmentPaletteSource,
  payoutsPaletteSource,
] as const;

const EMPTY_ASYNC_SOURCES: readonly (typeof ADMIN_ASYNC_SOURCES)[number][] = [];

type Props = {
  variant: "marketing" | "dashboard" | "admin";
  sessionUser?: SessionUser | null;
  clientWorkspaceMode?: ClientWorkspaceMode;
  shellRole?: ShellRole;
  pendingSubmissionCount?: number;
  pendingArtistCount?: number;
  navCounts?: AdminNavCounts;
};

export function CommandPalette({
  variant,
  sessionUser = null,
  clientWorkspaceMode = "buying",
  shellRole = "platform",
  pendingSubmissionCount = 0,
  pendingArtistCount = 0,
  navCounts = defaultPaletteNavCounts(),
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const asyncSources = variant === "admin" ? ADMIN_ASYNC_SOURCES : EMPTY_ASYNC_SOURCES;
  const { sections: asyncSections, loading } = useDebouncedPaletteSearch(asyncSources, query);

  const staticSections = useMemo(
    () =>
      buildStaticPaletteSections({
        variant,
        query,
        sessionUser,
        shellRole,
        clientWorkspaceMode,
        pendingSubmissionCount,
        pendingArtistCount,
        navCounts,
      }),
    [
      variant,
      query,
      sessionUser,
      shellRole,
      clientWorkspaceMode,
      pendingSubmissionCount,
      pendingArtistCount,
      navCounts,
    ],
  );

  const visibleSections = useMemo(
    () => buildVisiblePaletteSections(staticSections, asyncSections, query),
    [staticSections, asyncSections, query],
  );

  const close = useCallback(() => setOpen(false), []);

  const navigateTo = useCallback(
    (item: PaletteItem) => {
      pushPaletteRecent({
        kind: inferPaletteKind(item.href),
        id: item.id,
        href: item.href,
        label: item.label,
      });
      close();
      router.push(item.href);
    },
    [close, router],
  );

  useEffect(() => {
    const onPaletteOpen = () => {
      clearPendingPaletteOpen();
      setOpen(true);
    };
    window.addEventListener(PALETTE_OPEN_EVENT, onPaletteOpen);
    if (takePendingPaletteOpen()) setOpen(true);
    return () => window.removeEventListener(PALETTE_OPEN_EVENT, onPaletteOpen);
  }, []);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const dialogWidth = variant === "admin" ? "max-w-xl" : "max-w-lg";
  const listHeight = variant === "admin" ? "max-h-[min(60vh,28rem)]" : "max-h-[min(50vh,24rem)]";

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Quick go"
      description="Search pages and records"
      className={cn(dialogWidth)}
    >
      <Command shouldFilter={false} className="rounded-xl">
        <PaletteSearch value={query} onValueChange={setQuery} variant={variant} />
        <PaletteResults
          sections={visibleSections}
          query={query}
          loading={loading}
          listClassName={listHeight}
          onNavigate={navigateTo}
        />
      </Command>
    </CommandDialog>
  );
}

function inferPaletteKind(
  href: string,
): import("@/components/layout/palette/recents-store").PaletteEntityKind {
  if (href.includes("/admin/lots/")) return "lot";
  if (href.includes("/admin/sales/")) return "sale";
  if (href.includes("/admin/clients/")) return "client";
  if (href.includes("/admin/artists/")) return "artist";
  if (href.includes("/admin/payments")) return "payment";
  if (href.includes("/admin/invitations/")) return "invitation";
  return "route";
}
