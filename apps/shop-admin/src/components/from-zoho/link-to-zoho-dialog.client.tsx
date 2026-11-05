"use client";

import { LinkConfirmDialog } from "@/components/from-zoho/link-confirm-dialog.client";
import { adminMutationErrorMessage } from "@/lib/admin-mutation-message";
import {
  getZohoLinkPreview,
  searchZohoRecords,
} from "@/server/application/admin-zoho-link-actions.server";
import type {
  AdminZohoLinkPreview,
  AdminZohoLinkRecord,
  AdminZohoLinkSearchResult,
} from "@auction/shop-contracts";
import {
  Notice,
  Skeleton,
  StaffButton,
  StaffDialog,
  StatusBadge,
  TextInput,
} from "@auction/staff-ui";
import { useEffect, useState } from "react";

type Search =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "done"; result: AdminZohoLinkSearchResult };

export type RecordSearchViewProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artworkTitle: string;
  query: string;
  onQueryChange: (query: string) => void;
  search: Search;
  /** The record being read for the preview; its row is busy. */
  choosing: string | null;
  chooseError: string | null;
  onChoose: (record: AdminZohoLinkRecord) => void;
  onRetry: () => void;
};

/** Search the register for one artwork's record. Each row shows enough to be sure it is the one. */
export function RecordSearchView({
  open,
  onOpenChange,
  artworkTitle,
  query,
  onQueryChange,
  search,
  choosing,
  chooseError,
  onChoose,
  onRetry,
}: RecordSearchViewProps) {
  return (
    <StaffDialog
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title="Link to Zoho record"
      description={`Find the Zoho record for ${artworkTitle}. Records already linked to a lax.art artwork are not listed.`}
      footer={
        <StaffButton variant="secondary" onClick={() => onOpenChange(false)}>
          Cancel
        </StaffButton>
      }
    >
      <div className="flex flex-col gap-3">
        <TextInput
          aria-label="Search Zoho records"
          placeholder="Stock code, title or artist"
          value={query}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => onQueryChange(event.target.value)}
        />
        {chooseError ? (
          <Notice tone="danger" alert title="Could not read that record">
            {chooseError}
          </Notice>
        ) : null}
        {search.phase === "idle" ? (
          <p className="text-staff-sm text-staff-muted">
            Type at least two characters of the stock code, title or artist's name.
          </p>
        ) : search.phase === "loading" ? (
          // biome-ignore lint/a11y/useSemanticElements: a loading placeholder, not a form output
          <div className="flex flex-col gap-2" role="status" aria-label="Searching Zoho">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : search.phase === "error" ? (
          <Notice tone="danger" alert title="Could not search Zoho">
            <p>{search.message}</p>
            <StaffButton variant="secondary" size="sm" className="mt-2" onClick={onRetry}>
              Try again
            </StaffButton>
          </Notice>
        ) : search.result.items.length === 0 ? (
          <p className="text-staff-sm text-staff-muted">
            No unlinked original in Zoho matches “{query.trim()}”. Check the spelling, or try the
            stock code.
          </p>
        ) : (
          <>
            <ul aria-label="Zoho records" className="flex flex-col gap-2">
              {search.result.items.map((record) => (
                <li
                  key={record.registerId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-staff-md border border-staff-line p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-staff-sm font-medium text-staff-fg">
                      {record.title}
                    </p>
                    <p className="text-staff-xs text-staff-muted">
                      {record.artistName} · <span className="tabular-nums">{record.stockCode}</span>
                      {record.dimensions ? ` · ${record.dimensions}` : ""}
                      {record.year ? ` · ${record.year}` : ""}
                    </p>
                    <StatusBadge
                      tone={record.whereItIs === "Not offered" ? "neutral" : "info"}
                      className="mt-1"
                    >
                      {record.whereItIs}
                    </StatusBadge>
                  </div>
                  <StaffButton
                    variant="secondary"
                    size="sm"
                    loading={choosing === record.registerId}
                    disabled={choosing !== null}
                    onClick={() => onChoose(record)}
                    aria-label={`Choose ${record.title}, ${record.stockCode}`}
                  >
                    Choose
                  </StaffButton>
                </li>
              ))}
            </ul>
            {search.result.more ? (
              <p className="text-staff-xs text-staff-muted">
                More records match. Type more of the title or the stock code to narrow the list.
              </p>
            ) : null}
          </>
        )}
      </div>
    </StaffDialog>
  );
}

/**
 * "Link to Zoho record…" from an unlinked original's page: search the register, choose the record,
 * see what Zoho's details will change, and confirm. Nothing is linked before the confirmation.
 */
export function LinkToZohoDialog({
  open,
  onOpenChange,
  artworkId,
  artworkTitle,
  onLinked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artworkId: string;
  artworkTitle: string;
  onLinked: () => void;
}) {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<Search>({ phase: "idle" });
  const [attempt, setAttempt] = useState(0);
  const [choosing, setChoosing] = useState<string | null>(null);
  const [chooseError, setChooseError] = useState<string | null>(null);
  const [preview, setPreview] = useState<AdminZohoLinkPreview | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` re-runs the search on "Try again".
  useEffect(() => {
    if (!open) return;
    const text = query.trim();
    if (text.length < 2) {
      setSearch({ phase: "idle" });
      return;
    }
    setSearch({ phase: "loading" });
    let current = true;
    const timer = setTimeout(async () => {
      const result = await searchZohoRecords(text).catch(() => null);
      if (!current) return;
      if (result?.ok) setSearch({ phase: "done", result: result.data });
      else
        setSearch({
          phase: "error",
          message: result
            ? adminMutationErrorMessage(result)
            : "Could not search Zoho. Try again in a moment.",
        });
    }, 300);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [open, query, attempt]);

  async function choose(record: AdminZohoLinkRecord) {
    setChoosing(record.registerId);
    setChooseError(null);
    const result = await getZohoLinkPreview(artworkId, record.registerId).catch(() => null);
    setChoosing(null);
    if (result?.ok) setPreview(result.data);
    else
      setChooseError(
        result
          ? adminMutationErrorMessage(result)
          : "Could not read that record. Try again in a moment.",
      );
  }

  function change(next: boolean) {
    if (!next) {
      setPreview(null);
      setQuery("");
      setChooseError(null);
    }
    onOpenChange(next);
  }

  if (preview) {
    return (
      <LinkConfirmDialog
        open={open}
        onOpenChange={change}
        listing={preview.listing}
        candidate={preview.candidate}
        onLinked={onLinked}
      />
    );
  }
  return (
    <RecordSearchView
      open={open}
      onOpenChange={change}
      artworkTitle={artworkTitle}
      query={query}
      onQueryChange={setQuery}
      search={search}
      choosing={choosing}
      chooseError={chooseError}
      onChoose={(record) => void choose(record)}
      onRetry={() => setAttempt((n) => n + 1)}
    />
  );
}
