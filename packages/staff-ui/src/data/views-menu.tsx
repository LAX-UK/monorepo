"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@auction/ui/components/popover";
import { Count, type LinkComponent, TextInput } from "@auction/ui/lax";
import {
  Bookmark,
  Check,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Pencil,
  RotateCw,
  Trash2,
  Users,
  X,
} from "lucide-react";
import * as React from "react";
import { Skeleton } from "../display/states.js";
import { STAFF_LAYER, cn } from "../lib/cn.js";
import { StaffButton } from "../primitives/button.js";
import type { SavedView, SavedViewItem, SavedViewsControls } from "./saved-views.js";

/** A view the team shares, fixed in code: it cannot be renamed, reordered or deleted. */
export type TeamView = { id: string; label: string; query: string; href: string };

export const VIEW_LABEL_MAX_LENGTH = 40;

type Editing = { id: string; value: string; error?: string };

const rowButton = "size-6 [&_svg]:size-3.5";

function IconAction({
  label,
  children,
  ...props
}: { label: string; children: React.ReactNode } & Omit<
  React.ComponentProps<typeof StaffButton>,
  "children" | "aria-label"
>) {
  // A native title rather than a tooltip: a panel row repeats these buttons for every view, and
  // each label is already the button's accessible name.
  return (
    <StaffButton
      variant="ghost"
      size="icon-xs"
      aria-label={label}
      title={label}
      className={rowButton}
      {...props}
    >
      {children}
    </StaffButton>
  );
}

function GroupHeading({
  id,
  icon,
  children,
  hint,
  count,
}: {
  id: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  hint?: string;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-2 px-3 pt-3 pb-1.5">
      <span aria-hidden className="text-staff-muted [&_svg]:size-3.5">
        {icon}
      </span>
      <h3 id={id} className="text-staff-xs font-semibold text-staff-fg">
        {children}
      </h3>
      {count !== undefined && count > 0 ? <Count value={count} /> : null}
      {hint ? <span className="ml-auto text-staff-xs text-staff-subtle">{hint}</span> : null}
    </div>
  );
}

const linkClass = (active: boolean) =>
  cn(
    "staff-focus flex min-h-control-sm min-w-0 flex-1 items-center rounded-staff-sm px-2 text-staff-sm",
    active ? "font-medium text-staff-fg" : "text-staff-fg hover:bg-staff-hover",
  );

/**
 * The Views button and its panel: the team's fixed views above the person's own. Their views can
 * be renamed (Enter saves, Escape cancels), moved up or down, and deleted after a confirmation;
 * every control is a button, so all of it works from the keyboard.
 */
export function ViewsMenu({
  team,
  saved,
  savedHref,
  activeViewId,
  Link,
}: {
  team: readonly TeamView[];
  saved?: SavedViewsControls | undefined;
  savedHref?: ((view: SavedView) => string) | undefined;
  /** The team or saved view the list is showing, if it is one. */
  activeViewId: string | null;
  Link: LinkComponent;
}) {
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Editing | null>(null);
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null);
  const [announcement, setAnnouncement] = React.useState("");
  const [moveError, setMoveError] = React.useState<string | null>(null);
  const focusAfter = React.useRef<{ id: string; action: "up" | "down" } | null>(null);
  const panel = React.useRef<HTMLDivElement>(null);
  const views = saved?.views ?? [];
  const order = views.map((view) => view.id).join("|");

  // After a move the same button must keep focus, or the next move needs a Tab back to the row.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the order changes
  React.useEffect(() => {
    const target = focusAfter.current;
    if (!target) return;
    focusAfter.current = null;
    const row = panel.current?.querySelector<HTMLElement>(`[data-view-id="${target.id}"]`);
    const wanted = row?.querySelector<HTMLButtonElement>(`[data-action="${target.action}"]`);
    const other = row?.querySelector<HTMLButtonElement>(
      `[data-action="${target.action === "up" ? "down" : "up"}"]`,
    );
    (wanted && !wanted.disabled ? wanted : other)?.focus();
  }, [order]);

  React.useEffect(() => {
    if (!open) {
      setEditing(null);
      setConfirmingId(null);
      setMoveError(null);
    }
  }, [open]);

  const commitRename = async (current: Editing) => {
    if (!saved) return;
    const label = current.value.trim();
    const before = views.find((view) => view.id === current.id);
    if (!before || label === before.label) {
      setEditing(null);
      return;
    }
    if (!label) {
      setEditing({ ...current, error: "Name the view." });
      return;
    }
    setEditing(null);
    const result = await saved.rename(current.id, label);
    if (!result.ok) setEditing({ id: current.id, value: label, error: result.message });
  };

  const move = async (view: SavedViewItem, index: number, toIndex: number) => {
    if (!saved) return;
    focusAfter.current = { id: view.id, action: toIndex < index ? "up" : "down" };
    setMoveError(null);
    const result = await saved.move(view.id, toIndex);
    if (result.ok) {
      setAnnouncement(`Moved ${view.label} to position ${toIndex + 1} of ${views.length}`);
    } else {
      focusAfter.current = null;
      setMoveError(result.message);
    }
  };

  const confirmDelete = async (view: SavedViewItem) => {
    if (!saved) return;
    setConfirmingId(null);
    const result = await saved.remove(view.id);
    if (result.ok) setAnnouncement(`Deleted ${view.label}`);
    else setMoveError(result.message);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <StaffButton
          size="sm"
          variant="ghost"
          icon={<Bookmark aria-hidden />}
          className="shrink-0 text-staff-muted data-[state=open]:text-staff-fg"
        >
          Views
          <ChevronDown aria-hidden className="-mr-1 size-3.5" />
        </StaffButton>
      </PopoverTrigger>
      <PopoverContent
        {...STAFF_LAYER}
        align="end"
        sideOffset={6}
        aria-label="Views"
        ref={panel}
        // Escape backs out of a rename or a delete first; only then does it close the panel.
        onEscapeKeyDown={(event) => {
          if (editing) event.preventDefault();
          else if (confirmingId) {
            event.preventDefault();
            setConfirmingId(null);
          }
        }}
        className="w-[min(22rem,calc(100vw-2rem))] gap-0 rounded-staff-md border border-staff-line bg-staff-raised p-0 text-staff-fg shadow-staff-md"
      >
        <output className="sr-only">{announcement}</output>
        {team.length > 0 ? (
          <section aria-labelledby="staff-team-views" className="pb-1.5">
            <GroupHeading id="staff-team-views" icon={<Users aria-hidden />} hint="Shared">
              Team views
            </GroupHeading>
            <ul className="flex flex-col px-1.5">
              {team.map((view) => (
                <li key={view.id}>
                  <Link
                    href={view.href}
                    onClick={() => setOpen(false)}
                    {...(view.id === activeViewId ? { "aria-current": "page" as const } : {})}
                    className={linkClass(view.id === activeViewId)}
                  >
                    <span className="truncate">{view.label}</span>
                    {view.id === activeViewId ? (
                      <Check aria-hidden className="ml-auto size-3.5 shrink-0" />
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {saved ? (
          <section
            aria-labelledby="staff-my-views"
            className={cn("pb-1.5", team.length > 0 && "border-t border-staff-line")}
          >
            <GroupHeading
              id="staff-my-views"
              icon={<Bookmark aria-hidden />}
              count={saved.status === "ready" ? views.length : 0}
            >
              My views
            </GroupHeading>
            {saved.status === "loading" ? (
              <div aria-busy="true" className="flex flex-col gap-2 px-3 py-2">
                <span className="sr-only">Loading your views</span>
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-3/5" />
              </div>
            ) : saved.status === "error" ? (
              <div role="alert" className="flex flex-col items-start gap-2 px-3 py-2">
                <p className="flex items-start gap-2 text-staff-sm text-staff-danger-fg">
                  <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                  Your views did not load.
                </p>
                <StaffButton
                  size="sm"
                  variant="secondary"
                  icon={<RotateCw aria-hidden />}
                  onClick={saved.reload}
                >
                  Try again
                </StaffButton>
              </div>
            ) : views.length === 0 ? (
              <p className="px-3 py-2 text-staff-sm text-staff-muted">
                Nothing saved yet. Set the search and filters you want, then choose Save view to
                keep them here on every device.
              </p>
            ) : (
              <ul className="flex flex-col px-1.5">
                {views.map((view, index) => {
                  const active = view.id === activeViewId;
                  const href = savedHref?.(view) ?? "#";
                  const isEditing = editing?.id === view.id;
                  const isConfirming = confirmingId === view.id;
                  return (
                    <li
                      key={view.id}
                      data-view-id={view.id}
                      className="group/view flex flex-col rounded-staff-sm"
                    >
                      {isEditing && editing ? (
                        <form
                          className="flex items-center gap-1 py-0.5"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void commitRename(editing);
                          }}
                        >
                          <TextInput
                            size="sm"
                            autoFocus
                            aria-label={`Rename ${view.label}`}
                            aria-describedby={editing.error ? `rename-error-${view.id}` : undefined}
                            invalid={Boolean(editing.error)}
                            maxLength={VIEW_LABEL_MAX_LENGTH}
                            value={editing.value}
                            boxClassName="flex-1"
                            onChange={(event) =>
                              setEditing({ id: view.id, value: event.target.value })
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Escape") {
                                // Cancels the rename, not the whole panel.
                                event.preventDefault();
                                event.stopPropagation();
                                setEditing(null);
                              }
                            }}
                          />
                          <IconAction label="Save name" type="submit">
                            <Check aria-hidden />
                          </IconAction>
                          <IconAction label="Cancel rename" onClick={() => setEditing(null)}>
                            <X aria-hidden />
                          </IconAction>
                        </form>
                      ) : isConfirming ? (
                        <fieldset className="m-0 flex min-w-0 items-center gap-2 rounded-staff-xs border-0 bg-staff-danger-bg px-2 py-1">
                          <legend className="sr-only">Delete {view.label}</legend>
                          <span className="min-w-0 flex-1 truncate text-staff-sm text-staff-danger-fg">
                            Delete “{view.label}”?
                          </span>
                          <StaffButton
                            size="sm"
                            variant="ghost"
                            autoFocus
                            onClick={() => setConfirmingId(null)}
                            className="h-control-xs px-2 text-staff-xs"
                          >
                            Keep
                          </StaffButton>
                          <StaffButton
                            size="sm"
                            variant="danger"
                            onClick={() => void confirmDelete(view)}
                            className="h-control-xs px-2 text-staff-xs"
                          >
                            Delete
                          </StaffButton>
                        </fieldset>
                      ) : (
                        <div className="flex items-center gap-0.5">
                          <Link
                            href={href}
                            onClick={() => setOpen(false)}
                            {...(active ? { "aria-current": "page" as const } : {})}
                            className={linkClass(active)}
                          >
                            <span className="truncate">{view.label}</span>
                            {view.pending ? (
                              <span className="ml-2 text-staff-xs text-staff-subtle">Saving…</span>
                            ) : active ? (
                              <Check aria-hidden className="ml-auto size-3.5 shrink-0" />
                            ) : null}
                          </Link>
                          <div
                            className={cn(
                              "flex shrink-0 items-center",
                              "opacity-0 group-hover/view:opacity-100 group-focus-within/view:opacity-100",
                              "max-md:opacity-100 [@media(pointer:coarse)]:opacity-100",
                            )}
                          >
                            <IconAction
                              label={`Move ${view.label} up`}
                              data-action="up"
                              disabled={index === 0 || views.some((item) => item.pending)}
                              onClick={() => void move(view, index, index - 1)}
                            >
                              <ChevronUp aria-hidden />
                            </IconAction>
                            <IconAction
                              label={`Move ${view.label} down`}
                              data-action="down"
                              disabled={
                                index === views.length - 1 || views.some((item) => item.pending)
                              }
                              onClick={() => void move(view, index, index + 1)}
                            >
                              <ChevronDown aria-hidden />
                            </IconAction>
                            <IconAction
                              label={`Rename ${view.label}`}
                              disabled={view.pending ?? false}
                              onClick={() => setEditing({ id: view.id, value: view.label })}
                            >
                              <Pencil aria-hidden />
                            </IconAction>
                            <IconAction
                              label={`Delete ${view.label}`}
                              disabled={view.pending ?? false}
                              onClick={() => setConfirmingId(view.id)}
                            >
                              <Trash2 aria-hidden />
                            </IconAction>
                          </div>
                        </div>
                      )}
                      {isEditing && editing?.error ? (
                        <p
                          id={`rename-error-${view.id}`}
                          role="alert"
                          className="px-2 pb-1 text-staff-xs text-staff-danger-fg"
                        >
                          {editing.error}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
            {moveError ? (
              <p role="alert" className="px-3 pt-1 text-staff-xs text-staff-danger-fg">
                {moveError}
              </p>
            ) : null}
          </section>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
