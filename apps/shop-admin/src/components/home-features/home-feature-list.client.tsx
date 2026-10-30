"use client";

import { useStaffCatalogueImage } from "@/components/artworks/staff-catalogue-image-provider.client";
import { adminMutationErrorMessage } from "@/lib/admin-mutation-message";
import {
  HOME_FEATURE_SLOT_COPY,
  type HomeFeatureStatus,
  homeFeatureDraftIssues,
  homeFeatureIssueMessages,
  homeFeatureLimit,
  homeFeaturePickerMeta,
  homeFeatureRowView,
  homeFeatureStatuses,
  readHomeFeatureIssues,
  sameOrder,
} from "@/lib/home-features";
import type { AdminMutationResult } from "@/server/application/admin-mutation-result";
import type {
  AdminHomeFeatureRow,
  AdminHomeFeatureSlot,
  AdminHomeFeatures,
} from "@auction/shop-contracts";
import {
  CellThumbnail,
  type EntityOption,
  EntityPicker,
  FormActions,
  Notice,
  SortableList,
  StaffButton,
  StatusBadge,
  toast,
  useBeforeUnloadGuard,
} from "@auction/staff-ui";
import { Save } from "@auction/staff-ui/icons";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type Row = AdminHomeFeatureRow<AdminHomeFeatureSlot>;

/** The server calls a list needs; passed in so the list can be tested without a server. */
export type HomeFeatureListActions = {
  search: (slot: AdminHomeFeatureSlot, query: string) => Promise<Row[]>;
  save: (input: {
    slot: AdminHomeFeatureSlot;
    ids: string[];
    idempotencyKey: string;
  }) => Promise<AdminMutationResult<AdminHomeFeatures>>;
};

function StatusLine({ statuses }: { statuses: readonly HomeFeatureStatus[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {statuses.map((status) => (
        <StatusBadge key={status.label} tone={status.tone}>
          {status.label}
        </StatusBadge>
      ))}
    </span>
  );
}

function RowSummary({
  slot,
  row,
  statuses,
  issue,
}: {
  slot: AdminHomeFeatureSlot;
  row: Row;
  statuses: readonly HomeFeatureStatus[];
  issue: string | undefined;
}) {
  const view = homeFeatureRowView(slot, row);
  // Seed pictures are storefront paths; the shared resolver loads them from their storefront.
  const resolveImage = useStaffCatalogueImage();
  return (
    <div className="flex min-w-0 items-start gap-3">
      {view.image ? (
        <span className="hidden pt-0.5 sm:block">
          <CellThumbnail src={resolveImage(view.image.src)} label={view.image.missingLabel} />
        </span>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-staff-sm font-medium text-staff-fg">{view.title}</span>
          {view.subtitle ? (
            <span className="truncate text-staff-xs text-staff-muted">{view.subtitle}</span>
          ) : null}
        </span>
        <StatusLine statuses={statuses} />
        {issue ? (
          <span className="text-staff-xs font-medium text-staff-danger">{issue}</span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * One featured list: its rows in order with what each does on the home pages, reordered by drag
 * or keyboard, added from a search and removed, then saved as a whole. Read-only without
 * `actions`. A refused save marks the rows at fault and keeps the list as it was edited.
 */
export function HomeFeatureList({
  slot,
  saved,
  actions,
  onSaved,
}: {
  slot: AdminHomeFeatureSlot;
  saved: readonly Row[];
  actions?: HomeFeatureListActions;
  onSaved?: (features: AdminHomeFeatures) => void;
}) {
  const copy = HOME_FEATURE_SLOT_COPY[slot];
  const limit = homeFeatureLimit(slot);
  const [rows, setRows] = useState<readonly Row[]>(saved);
  /** The list as last saved: what the edits are compared with and what Discard returns to. */
  const [baseline, setBaseline] = useState<readonly Row[]>(saved);
  const [issues, setIssues] = useState<Map<string, string>>(new Map());
  const [notice, setNotice] = useState<{ text: string; stepUp: boolean } | null>(null);
  const [pending, setPending] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const dirty = !sameOrder(rows, baseline);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const latest = useRef(rows);
  latest.current = rows;
  const found = useRef(new Map<string, Row>());
  useBeforeUnloadGuard(dirty);

  // Another list's save returns every list; adopt the new facts unless this one has edits.
  useEffect(() => {
    setBaseline(saved);
    if (!dirtyRef.current) setRows(saved);
  }, [saved]);

  const headingId = `home-feature-${slot}-heading`;
  const statuses = homeFeatureStatuses(slot, rows);
  const full = rows.length >= limit;

  const edit = (next: readonly Row[]) => {
    setRows(next);
    if (issues.size > 0) setIssues(new Map());
    setNotice(null);
  };

  const searchOptions = useCallback(
    async (query: string): Promise<EntityOption[]> => {
      if (!actions) return [];
      const results = await actions.search(slot, query);
      const chosen = new Set(latest.current.map((row) => row.id));
      return results.map((row) => {
        found.current.set(row.id, row);
        const view = homeFeatureRowView(slot, row);
        const added = chosen.has(row.id);
        const meta = added ? "Added" : homeFeaturePickerMeta(slot, row);
        return {
          id: row.id,
          label: view.title,
          ...(view.subtitle ? { description: view.subtitle } : {}),
          ...(meta ? { meta } : {}),
          disabled: added,
        };
      });
    },
    [actions, slot],
  );

  async function save() {
    if (!actions) return;
    const ids = rows.map((row) => row.id);
    const draftIssues = homeFeatureDraftIssues(slot, ids);
    if (draftIssues.length > 0) {
      setIssues(homeFeatureIssueMessages(slot, draftIssues));
      setNotice({ text: "Some rows need a change before this list can be saved.", stepUp: false });
      return;
    }
    setPending(true);
    setNotice(null);
    let result: AdminMutationResult<AdminHomeFeatures>;
    try {
      result = await actions.save({ slot, ids, idempotencyKey });
    } catch {
      result = {
        ok: false,
        kind: "failed",
        message: `Could not save the ${copy.plural}. Try again.`,
      };
    } finally {
      setPending(false);
    }
    if (!result.ok) {
      const rowIssues = result.kind === "validation" ? readHomeFeatureIssues(result.issues) : [];
      setIssues(homeFeatureIssueMessages(slot, rowIssues));
      setNotice({
        text: adminMutationErrorMessage(result),
        stepUp: result.kind === "step_up_required",
      });
      return;
    }
    setIdempotencyKey(crypto.randomUUID());
    setIssues(new Map());
    setRows(result.data[slot]);
    setBaseline(result.data[slot]);
    onSaved?.(result.data);
    toast.success(`${copy.title} saved`);
  }

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-4 rounded-staff-lg border border-staff-line bg-staff-surface p-4 sm:p-6"
    >
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2
            id={headingId}
            tabIndex={-1}
            className="staff-focus rounded-staff-xs font-staff text-staff-md font-semibold text-staff-fg"
          >
            {copy.title}
          </h2>
          {dirty ? <StatusBadge tone="warning">Unsaved changes</StatusBadge> : null}
        </div>
        <p className="text-staff-sm text-staff-muted">
          {copy.description} Up to {limit}.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-staff-lg border border-dashed border-staff-line px-4 py-6 text-center text-staff-sm text-staff-muted">
          {copy.emptyText}
        </p>
      ) : (
        <SortableList
          label={copy.title}
          items={rows}
          getKey={(row) => row.id}
          itemName={(row) => homeFeatureRowView(slot, row).title}
          invalid={(row) => issues.has(row.id)}
          disabled={pending}
          {...(actions
            ? {
                onMove: (from: number, to: number) => {
                  const next = [...rows];
                  const [moved] = next.splice(from, 1);
                  if (moved) next.splice(to, 0, moved);
                  edit(next);
                },
                onRemove: (index: number) => edit(rows.filter((_, at) => at !== index)),
              }
            : {})}
          renderItem={(row, index) => (
            <RowSummary
              slot={slot}
              row={row}
              statuses={statuses[index] ?? []}
              issue={issues.get(row.id)}
            />
          )}
        />
      )}

      {notice ? (
        <Notice
          tone="danger"
          alert
          title={notice.text}
          {...(notice.stepUp
            ? {
                actions: (
                  <StaffButton asChild size="sm" variant="secondary">
                    <Link href="/api/auth/login?returnTo=%2Feditorial%2Ffeatured">
                      Sign in again
                    </Link>
                  </StaffButton>
                ),
              }
            : {})}
        />
      ) : null}

      {actions ? (
        <FormActions
          start={
            <div className="flex min-w-0 flex-col gap-1">
              <EntityPicker
                value={null}
                onValueChange={(option) => {
                  const row = option ? found.current.get(option.id) : undefined;
                  if (row && !rows.some((existing) => existing.id === row.id)) {
                    edit([...rows, row]);
                  }
                }}
                search={searchOptions}
                placeholder={copy.addLabel}
                searchPlaceholder={`Search ${copy.plural} by name`}
                emptyText={`No ${copy.plural} match.`}
                disabled={pending || full}
                aria-label={copy.addLabel}
                className="w-full sm:w-72"
              />
              {full ? (
                <span className="text-staff-xs text-staff-muted">
                  The list is full at {limit} {copy.plural}. Remove one to add another.
                </span>
              ) : null}
            </div>
          }
        >
          {dirty ? (
            <StaffButton
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => edit(baseline)}
            >
              Discard changes
            </StaffButton>
          ) : null}
          <StaffButton
            type="button"
            variant="primary"
            icon={<Save aria-hidden />}
            {...(dirty || pending ? {} : { disabledReason: "No changes to save" })}
            loading={pending}
            onClick={() => void save()}
          >
            {pending ? "Saving…" : `Save ${copy.plural}`}
          </StaffButton>
        </FormActions>
      ) : null}
    </section>
  );
}
