"use client";

import { useStaffCatalogueImage } from "@/components/artworks/staff-catalogue-image-provider.client";
import { LinkChanges } from "@/components/from-zoho/link-changes";
import { adminMutationErrorMessage } from "@/lib/admin-mutation-message";
import {
  getZohoLinkPreview,
  linkToZoho,
  searchZohoRecords,
} from "@/server/application/admin-zoho-link-actions.server";
import { LINK_RULE_CHIPS } from "@/server/domain/zoho-link-list.vm";
import type {
  AdminZohoLinkCandidate,
  AdminZohoLinkRecord,
  AdminZohoLinkRow,
  AdminZohoLinkSearchResult,
} from "@auction/shop-contracts";
import {
  Notice,
  RecordThumbnail,
  Skeleton,
  StaffButton,
  StaffDialog,
  StaffRadio,
  StaffRadioGroup,
  StatusBadge,
  TextInput,
  cn,
  toast,
} from "@auction/staff-ui";
import { useEffect, useMemo, useState } from "react";

/** A record the report already proposes for this artwork, with what it was matched on. */
export type LinkSuggestion = {
  candidate: AdminZohoLinkCandidate;
  rule: AdminZohoLinkRow["rule"];
};

export type RecordSearch =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "done"; result: AdminZohoLinkSearchResult };

/** What the chosen record would do to the artwork. */
export type LinkDetail =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; candidate: AdminZohoLinkCandidate };

type Option = { record: AdminZohoLinkRecord; chips: readonly string[] };

function RecordOption({
  option,
  checked,
  index,
}: {
  option: Option;
  checked: boolean;
  index: number;
}) {
  const resolve = useStaffCatalogueImage();
  const { record } = option;
  const taken = record.linkedTo !== null;
  const id = `link-record-${record.registerId}`;
  return (
    <label
      htmlFor={id}
      data-taken={taken ? "true" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-staff-md border p-3",
        taken
          ? "cursor-not-allowed border-staff-line-subtle bg-staff-sunken"
          : "cursor-pointer border-staff-line hover:bg-staff-hover",
        checked && "border-staff-ink outline outline-1 outline-staff-ink",
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-staff-ink",
      )}
    >
      <StaffRadio
        id={id}
        value={record.registerId}
        disabled={taken}
        aria-label={`${record.title}, ${record.stockCode}`}
        data-option-index={index}
      />
      <RecordThumbnail
        src={resolve(record.imageUrl)}
        title={record.title}
        className="size-10 rounded-staff-sm"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span
          className={cn("text-staff-sm font-medium", taken ? "text-staff-muted" : "text-staff-fg")}
        >
          {record.title}
        </span>
        <span className="text-staff-xs text-staff-muted">
          <span className="tabular-nums">{record.stockCode}</span>
          {record.dimensions ? ` · ${record.dimensions}` : ""}
          {record.year ? ` · ${record.year}` : ""} · {record.whereItIs}
        </span>
        {option.chips.length > 0 ? (
          <span className="flex flex-wrap gap-1">
            {option.chips.map((chip, chipIndex) => (
              <StatusBadge
                key={chip}
                tone={chipIndex === 0 && chip === "Stock code" ? "success" : "neutral"}
              >
                {chip}
              </StatusBadge>
            ))}
          </span>
        ) : null}
        {taken ? (
          <span className="flex">
            <StatusBadge tone="neutral">Linked to ‘{record.linkedTo}’</StatusBadge>
          </span>
        ) : null}
      </span>
    </label>
  );
}

export type LinkToZohoViewProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "Harbour at dusk · Ben Ilsley · Live on lax.art". */
  subtitle: string;
  /** Whether the lax.art listing is live; says what linking does with its place. */
  published: boolean | null;
  query: string;
  onQueryChange: (query: string) => void;
  search: RecordSearch;
  suggestions: readonly LinkSuggestion[];
  selectedId: string | null;
  onSelect: (record: AdminZohoLinkRecord) => void;
  detail: LinkDetail | null;
  onRetrySearch: () => void;
  saving: boolean;
  /** Why the last attempt was refused or failed, in the register's words. */
  error: string | null;
  onConfirm: () => void;
};

/**
 * Link one lax.art artwork to its Zoho record: the records worth choosing from (the report's
 * suggestions, or what a search finds), a record already linked to another listing shown and
 * unavailable, and what the chosen record would change before anything is linked.
 */
export function LinkToZohoView({
  open,
  onOpenChange,
  subtitle,
  published,
  query,
  onQueryChange,
  search,
  suggestions,
  selectedId,
  onSelect,
  detail,
  onRetrySearch,
  saving,
  error,
  onConfirm,
}: LinkToZohoViewProps) {
  const searching = query.trim().length >= 2;
  const options: Option[] = useMemo(() => {
    if (searching) {
      return search.phase === "done"
        ? search.result.items.map((record) => ({ record, chips: [] }))
        : [];
    }
    return suggestions.map(({ candidate, rule }) => ({
      record: candidate.record,
      chips: rule ? LINK_RULE_CHIPS[rule] : [],
    }));
  }, [searching, search, suggestions]);
  const chosen = detail?.phase === "ready" ? detail.candidate : null;
  const refused = chosen?.refusal ?? null;
  const canLink = chosen !== null && refused === null;

  return (
    <StaffDialog
      open={open}
      onOpenChange={(next) => {
        if (!saving) onOpenChange(next);
      }}
      size="md"
      title="Link to Zoho record"
      description={subtitle}
      footer={
        <>
          <StaffButton variant="secondary" disabled={saving} onClick={() => onOpenChange(false)}>
            Cancel
          </StaffButton>
          <StaffButton variant="primary" loading={saving} disabled={!canLink} onClick={onConfirm}>
            {error
              ? "Try again"
              : chosen
                ? `Link to ${chosen.record.stockCode}`
                : "Link to Zoho record"}
          </StaffButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextInput
          aria-label="Search Zoho records"
          placeholder="Stock code, title or artist"
          value={query}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => onQueryChange(event.target.value)}
        />
        {searching && search.phase === "loading" ? (
          // biome-ignore lint/a11y/useSemanticElements: a loading placeholder, not a form output
          <div className="flex flex-col gap-2" role="status" aria-label="Searching Zoho">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : searching && search.phase === "error" ? (
          <Notice tone="danger" alert title="Could not search Zoho">
            <p>{search.message}</p>
            <StaffButton variant="secondary" size="sm" className="mt-2" onClick={onRetrySearch}>
              Try again
            </StaffButton>
          </Notice>
        ) : options.length > 0 ? (
          <section className="flex flex-col gap-2" aria-label={searching ? "Results" : "Suggested"}>
            <h3 className="text-staff-sm font-medium text-staff-muted">
              {searching ? "Results" : "Suggested"}
            </h3>
            <StaffRadioGroup
              aria-label="Zoho records"
              value={selectedId ?? ""}
              onValueChange={(value) => {
                const found = options.find((option) => option.record.registerId === value);
                if (found) onSelect(found.record);
              }}
              className="grid-cols-[minmax(0,1fr)] gap-2"
            >
              {options.map((option, index) => (
                <RecordOption
                  key={option.record.registerId}
                  option={option}
                  index={index}
                  checked={option.record.registerId === selectedId}
                />
              ))}
            </StaffRadioGroup>
            {searching && search.phase === "done" && search.result.more ? (
              <p className="text-staff-xs text-staff-muted">
                More records match. Type more of the title or the stock code to narrow the list.
              </p>
            ) : null}
          </section>
        ) : searching && search.phase === "done" ? (
          <p className="text-staff-sm text-staff-muted">
            No Zoho original matches “{query.trim()}”. Check the spelling, or try the stock code.
          </p>
        ) : (
          <p className="text-staff-sm text-staff-muted">
            Type at least two characters of the stock code, title or artist's name.
          </p>
        )}

        {error ? (
          <Notice tone="danger" alert title="Not linked">
            {error}
          </Notice>
        ) : null}
        {detail?.phase === "loading" ? (
          // biome-ignore lint/a11y/useSemanticElements: a loading placeholder, not a form output
          <div role="status" aria-label="Checking this record">
            <Skeleton className="h-40 w-full" />
          </div>
        ) : null}
        {detail?.phase === "error" ? (
          <Notice tone="danger" alert title="Could not read that record">
            {detail.message}
          </Notice>
        ) : null}
        {refused ? (
          <Notice tone="warning" title="This artwork can't be linked to that record now">
            {refused}
          </Notice>
        ) : null}
        {chosen && !refused ? (
          <LinkChanges
            comparison={chosen.comparison}
            published={published}
            whereItIs={chosen.record.whereItIs}
          />
        ) : null}
      </div>
    </StaffDialog>
  );
}

/**
 * "Link to Zoho record…": from a report row (the suggestions are already known) or from an
 * artwork's own page (search the register). Nothing is linked until staff confirm.
 */
export function LinkToZohoDialog({
  open,
  onOpenChange,
  artworkId,
  subtitle,
  published = null,
  suggestions = [],
  initialRegisterId = null,
  onLinked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artworkId: string;
  subtitle: string;
  published?: boolean | null;
  suggestions?: readonly LinkSuggestion[];
  /** The record to start with chosen; by default the only suggestion, if there is just one. */
  initialRegisterId?: string | null;
  onLinked: () => void;
}) {
  const known = useMemo(
    () => new Map(suggestions.map((s) => [s.candidate.record.registerId, s.candidate])),
    [suggestions],
  );
  const start =
    initialRegisterId ??
    (suggestions.length === 1 ? (suggestions[0]?.candidate.record.registerId ?? null) : null);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<RecordSearch>({ phase: "idle" });
  const [attempt, setAttempt] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(start);
  const [previews, setPreviews] = useState<ReadonlyMap<string, LinkDetail>>(new Map());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function select(record: AdminZohoLinkRecord) {
    setSelectedId(record.registerId);
    setError(null);
    if (known.has(record.registerId) || previews.get(record.registerId)?.phase === "ready") return;
    setPreviews((current) => new Map(current).set(record.registerId, { phase: "loading" }));
    const result = await getZohoLinkPreview(artworkId, record.registerId).catch(() => null);
    const detail: LinkDetail = result?.ok
      ? { phase: "ready", candidate: result.data.candidate }
      : {
          phase: "error",
          message: result
            ? adminMutationErrorMessage(result)
            : "Could not read that record. Try again in a moment.",
        };
    setPreviews((current) => new Map(current).set(record.registerId, detail));
  }

  const knownCandidate = selectedId ? known.get(selectedId) : undefined;
  const detail: LinkDetail | null = knownCandidate
    ? { phase: "ready", candidate: knownCandidate }
    : selectedId
      ? (previews.get(selectedId) ?? { phase: "loading" })
      : null;

  async function submit() {
    if (detail?.phase !== "ready") return;
    setSaving(true);
    setError(null);
    const result = await linkToZoho({
      artworkId,
      registerId: detail.candidate.record.registerId,
    }).catch(() => null);
    setSaving(false);
    if (result?.ok) {
      toast.success(
        result.data.status === "already_linked"
          ? "Already linked to this record"
          : "Linked to the Zoho record",
      );
      onOpenChange(false);
      onLinked();
      return;
    }
    setError(
      result
        ? adminMutationErrorMessage(result)
        : "Could not link the artwork. Try again in a moment.",
    );
  }

  return (
    <LinkToZohoView
      open={open}
      onOpenChange={onOpenChange}
      subtitle={subtitle}
      published={published}
      query={query}
      onQueryChange={setQuery}
      search={search}
      suggestions={suggestions}
      selectedId={selectedId}
      onSelect={(record) => void select(record)}
      detail={detail}
      onRetrySearch={() => setAttempt((n) => n + 1)}
      saving={saving}
      error={error}
      onConfirm={() => void submit()}
    />
  );
}
