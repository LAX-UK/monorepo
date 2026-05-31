"use client";

import { PALETTE_OPEN_EVENT } from "@/components/layout/command-palette-events";
import {
  pushPaletteRecent,
  readPalettePinned,
  readPaletteRecents,
} from "@/components/layout/palette/palette-cookie-client";
import { PaletteResults } from "@/components/layout/palette/palette-results";
import { PaletteSearch } from "@/components/layout/palette/palette-search";
import { buildActionPaletteItems } from "@/components/layout/palette/sources/actions-source";
import { artistsPaletteSource } from "@/components/layout/palette/sources/artists-source";
import { clientsPaletteSource } from "@/components/layout/palette/sources/clients-source";
import { conditionReportsPaletteSource } from "@/components/layout/palette/sources/condition-reports-source";
import { invitationsPaletteSource } from "@/components/layout/palette/sources/invitations-source";
import { lotFulfilmentPaletteSource } from "@/components/layout/palette/sources/lot-fulfilment-source";
import { lotsPaletteSource } from "@/components/layout/palette/sources/lots-source";
import { buildNavPaletteSections } from "@/components/layout/palette/sources/nav-source";
import { paymentsPaletteSource } from "@/components/layout/palette/sources/payments-source";
import { payoutsPaletteSource } from "@/components/layout/palette/sources/payouts-source";
import { salesPaletteSource } from "@/components/layout/palette/sources/sales-source";
import { submissionsPaletteSource } from "@/components/layout/palette/sources/submissions-source";
import type { PaletteItem, PaletteSection } from "@/components/layout/palette/types";
import { useDebouncedPaletteSearch } from "@/components/layout/palette/use-debounced-palette-search";
import type { SessionUser } from "@/lib/data/contracts";
import type { ClientWorkspaceMode } from "@/lib/workspace/client-workspace-mode";
import { Command, CommandDialog } from "@auction/ui";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

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
  pendingSubmissionCount?: number;
  pendingArtistCount?: number;
};

export function CommandPalette({
  variant,
  sessionUser = null,
  clientWorkspaceMode = "buying",
  pendingSubmissionCount = 0,
  pendingArtistCount = 0,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const asyncSources = variant === "admin" ? ADMIN_ASYNC_SOURCES : EMPTY_ASYNC_SOURCES;

  const { sections: asyncSections, loading } = useDebouncedPaletteSearch(asyncSources, query);

  const staticSections = useMemo(() => {
    const nav = buildNavPaletteSections(
      variant,
      query,
      sessionUser,
      clientWorkspaceMode,
      pendingSubmissionCount,
      pendingArtistCount,
    );
    const recents = readPaletteRecents().map((e) => ({
      id: `recent-${e.kind}-${e.id}`,
      href: e.href,
      label: e.label,
      hint: "Recent",
    }));
    const pinned = readPalettePinned().map((e) => ({
      id: `pinned-${e.kind}-${e.id}`,
      href: e.href,
      label: e.label,
      hint: "Pinned",
    }));
    const sections: PaletteSection[] = [];
    if (!query.trim() && pinned.length > 0) {
      sections.push({ id: "pinned", heading: "Pinned", items: pinned });
    }
    if (!query.trim() && recents.length > 0) {
      sections.push({ id: "recents", heading: "Recents", items: recents });
    }
    sections.push(...nav);
    const actions = buildActionPaletteItems(query, variant, sessionUser);
    if (actions.length > 0) {
      sections.push({ id: "actions", heading: "Actions", items: actions });
    }
    return sections;
  }, [
    variant,
    query,
    sessionUser,
    clientWorkspaceMode,
    pendingSubmissionCount,
    pendingArtistCount,
  ]);

  const visibleSections = useMemo(() => {
    if (query.trim().length >= 2) {
      return [...staticSections.filter((s) => s.id === "actions"), ...asyncSections];
    }
    return staticSections;
  }, [staticSections, asyncSections, query]);

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
    const onPaletteOpen = () => setOpen(true);
    window.addEventListener(PALETTE_OPEN_EVENT, onPaletteOpen);
    return () => window.removeEventListener(PALETTE_OPEN_EVENT, onPaletteOpen);
  }, []);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Quick go"
      description="Search pages and records"
      className="max-w-lg"
    >
      <Command shouldFilter={false} className="rounded-xl">
        <PaletteSearch value={query} onValueChange={setQuery} />
        <PaletteResults sections={visibleSections} loading={loading} onNavigate={navigateTo} />
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
  if (href.includes("/admin/invitations")) return "invitation";
  return "route";
}
