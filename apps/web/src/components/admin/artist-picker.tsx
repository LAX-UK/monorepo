"use client";

import { ArtistSearch, type ArtistSearchHit } from "@/components/artists/artist-search";
import { CreateArtistDialog } from "@/components/artists/create-artist-dialog";
import {
  ARTIST_KIND_OPTIONS,
  artistKindMeta,
  artistStatusLabel,
} from "@/lib/artists/kind-presenter";
import type { ArtistKind, ArtistStatus } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { Pencil, X } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

/** Minimal display shape the picker needs to render a selected artist chip.
 * The form host typically owns the source of truth (existing artist list or
 * the artist resolved by `findById`) and passes it in. */
export type ArtistChipModel = {
  id: string;
  displayName: string;
  slug: string;
  kind: ArtistKind;
  status: ArtistStatus;
};

type Props = {
  /** Currently selected artist id (controlled). `null` means unattributed. */
  value: string | null;
  onChange: (artistId: string | null) => void;
  /** Resolved metadata for the currently selected id, when available. The
   * picker still works without it — it'll show "Selected artist" placeholder. */
  selected?: ArtistChipModel | null;
  /** Optional kind filter. When set, the search hit list and the inline
   * create default kind both honour it. (OCP: the picker doesn't branch on
   * the kind values internally.) */
  filterKinds?: ReadonlyArray<ArtistKind>;
  /** Pre-fill the create dialog name when the user hits "Create new". Useful
   * on the submission approve flow where we suggest the submitter's name. */
  createInitialName?: string;
  /** Pre-fill `ownerUserId` on the create dialog when the submitter is the
   * maker. The dialog does not surface this field; it is passed through on submit. */
  createOwnerUserId?: string | null;
  /** Disable the entire picker (e.g. when the lot is published). */
  disabled?: boolean;
  /** Optional explanatory copy shown under the selected chip. */
  helpText?: string;
};

/** Admin-only artist picker used on lot create, lot marketing, and submission
 * approve. Composes {@link ArtistSearch} + {@link CreateArtistDialog} and
 * exposes a single selection contract. */
export function ArtistPicker({
  value,
  onChange,
  selected = null,
  filterKinds,
  createInitialName,
  createOwnerUserId,
  disabled = false,
  helpText,
}: Props) {
  const [editing, setEditing] = useState(value === null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createSeed, setCreateSeed] = useState(createInitialName ?? "");
  const [activeKind, setActiveKind] = useState<ArtistKind | "all">("all");

  // When the value flips from null -> something, snap out of edit mode so the
  // chip is shown. When it flips back to null we re-open the search panel.
  useEffect(() => {
    setEditing(value === null);
  }, [value]);

  const allowedKinds = useMemo<ReadonlyArray<ArtistKind>>(
    () =>
      filterKinds && filterKinds.length > 0
        ? filterKinds
        : (ARTIST_KIND_OPTIONS.map((o) => o.value) as ArtistKind[]),
    [filterKinds],
  );

  function handleSelect(hit: ArtistSearchHit) {
    if (activeKind !== "all" && hit.kind !== activeKind) return;
    if (!allowedKinds.includes(hit.kind)) return;
    if (hit.status === "merged_into") return;
    onChange(hit.id);
  }

  function handleCreated(artist: { id: string }) {
    setCreateOpen(false);
    onChange(artist.id);
  }

  function handleClear() {
    onChange(null);
    setEditing(true);
  }

  if (!editing && selected) {
    const status = artistStatusLabel(selected.status);
    const kindMeta = artistKindMeta(selected.kind);
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3 rounded-md border border-outline-variant/40 bg-surface-container-lowest p-3">
          <div className="flex flex-1 flex-col">
            <span className="font-medium text-on-surface">{selected.displayName}</span>
            <span className="font-label text-[11px] uppercase tracking-wide text-on-surface-variant">
              {kindMeta.badge} · {status.label} · /{selected.slug}
            </span>
          </div>
          <InlineActionButton
            onClick={() => setEditing(true)}
            disabled={disabled}
            aria-label="Change artist"
          >
            <Pencil className="size-3.5" />
            Change
          </InlineActionButton>
          <InlineActionButton
            onClick={handleClear}
            disabled={disabled}
            aria-label="Remove artist attribution"
          >
            <X className="size-3.5" />
          </InlineActionButton>
        </div>
        {helpText ? <p className="text-xs text-on-surface-variant">{helpText}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <KindFilterChips
        value={activeKind}
        allowed={allowedKinds}
        onChange={setActiveKind}
        disabled={disabled}
      />
      <ArtistSearch
        initialQuery={createInitialName ?? ""}
        onSelect={handleSelect}
        onCreateNew={(q) => {
          setCreateSeed(q);
          setCreateOpen(true);
        }}
        disabled={disabled}
        mode="admin"
        placeholder="Search by name, alias, or maker…"
      />
      {value !== null ? (
        <InlineActionButton onClick={() => setEditing(false)} disabled={disabled}>
          Cancel change
        </InlineActionButton>
      ) : null}
      <div className="flex items-center justify-between rounded-md border border-dashed border-outline-variant/50 px-3 py-2 text-xs text-on-surface-variant">
        <span>Don&apos;t see them? Add a new catalogue entry.</span>
        <InlineActionButton
          onClick={() => {
            setCreateSeed(createInitialName ?? "");
            setCreateOpen(true);
          }}
          disabled={disabled}
        >
          New artist / maker
        </InlineActionButton>
      </div>
      {helpText ? <p className="text-xs text-on-surface-variant">{helpText}</p> : null}
      <CreateArtistDialog
        open={createOpen}
        initialName={createSeed}
        onCreated={(a) => handleCreated(a)}
        onCancel={() => setCreateOpen(false)}
        {...(createOwnerUserId ? { ownerUserId: createOwnerUserId } : {})}
        defaultKind={activeKind !== "all" ? activeKind : undefined}
      />
    </div>
  );
}

function KindFilterChips({
  value,
  allowed,
  onChange,
  disabled,
}: {
  value: ArtistKind | "all";
  allowed: ReadonlyArray<ArtistKind>;
  onChange: (next: ArtistKind | "all") => void;
  disabled: boolean;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      role="radiogroup"
      aria-label="Filter by kind"
    >
      <Chip active={value === "all"} disabled={disabled} onClick={() => onChange("all")}>
        All
      </Chip>
      {allowed.map((k) => (
        <Chip key={k} active={value === k} disabled={disabled} onClick={() => onChange(k)}>
          {artistKindMeta(k).badge}
        </Chip>
      ))}
    </div>
  );
}

/** Compact picker actions (change / clear / cancel / “new artist”). */
function InlineActionButton({
  onClick,
  disabled,
  children,
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "className"> & {
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-auto min-h-0 items-center gap-1.5 rounded-md border border-outline-variant/50 bg-surface-container-lowest px-2.5 py-1 font-label text-[11px] uppercase tracking-wide text-on-surface shadow-none transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-60"
      {...rest}
    >
      {children}
    </Button>
  );
}

function Chip({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      // biome-ignore lint/a11y/useSemanticElements: kind filter uses pill buttons to match admin UI
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onClick}
      className={`h-auto min-h-0 rounded-full border px-3 py-1 font-label text-[11px] uppercase tracking-wide shadow-none transition-colors ${
        active
          ? "border-primary bg-primary text-on-primary"
          : "border-outline-variant/60 bg-surface-container-lowest text-on-surface-variant hover:border-link/50 hover:text-on-surface"
      } disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {children}
    </Button>
  );
}
