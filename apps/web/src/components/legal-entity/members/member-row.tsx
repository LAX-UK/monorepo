"use client";

import type { MemberRowView } from "@/lib/legal-entity/member-row.vm";
import { RecordRow } from "@auction/ui";
import { Button, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@auction/ui/lax";
import {
  ArrowLeftRight,
  Clock,
  Ellipsis,
  LogOut,
  TriangleAlert,
  UserCog,
  UserMinus,
} from "lucide-react";
import Link from "next/link";
import { MemberInitials } from "./member-initials";

type Props = {
  row: MemberRowView;
  /** The role the row shows (the saved one, or one the server is deciding on). */
  shownRole: string;
  error: string | null;
  organisationName: string;
  onChangeRole: () => void;
  onTransfer: () => void;
  onRemove: () => void;
  onLeave: () => void;
};

/** The "…" menu: what else the viewer may do about this person, destructive steps last. */
function MemberMenu({
  row,
  organisationName,
  onChangeRole,
  onTransfer,
  onRemove,
  onLeave,
}: Pick<
  Props,
  "row" | "organisationName" | "onChangeRole" | "onTransfer" | "onRemove" | "onLeave"
>) {
  const leading = [row.roleOptions, row.activityHref, row.transfer].some(Boolean);
  const trailing = row.canRemove || row.leave !== null;
  // An empty slot the size of the button keeps every row's role in one column.
  if (!leading && !trailing) return <span aria-hidden className="block size-lax-control-md" />;
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="ghost" size="icon-md" aria-label={`More for ${row.name}`}>
          <Ellipsis aria-hidden />
        </Button>
      </MenuTrigger>
      <MenuContent className="w-72">
        {row.roleOptions ? (
          <MenuItem onSelect={onChangeRole}>
            <UserCog aria-hidden />
            Change role…
          </MenuItem>
        ) : null}
        {row.activityHref ? (
          <MenuItem asChild>
            <Link href={row.activityHref}>
              <Clock aria-hidden />
              View activity
            </Link>
          </MenuItem>
        ) : null}
        {row.transfer ? (
          <MenuItem onSelect={onTransfer}>
            <ArrowLeftRight aria-hidden />
            Transfer ownership…
          </MenuItem>
        ) : null}
        {leading && trailing ? <MenuSeparator /> : null}
        {row.canRemove ? (
          <MenuItem tone="danger" onSelect={onRemove}>
            <UserMinus aria-hidden />
            Remove from {organisationName}…
          </MenuItem>
        ) : null}
        {row.leave ? (
          <MenuItem
            tone={row.leave.allowed ? "danger" : "default"}
            onSelect={onLeave}
            {...(row.leave.allowed ? {} : { disabledReason: row.leave.reason })}
          >
            <LogOut aria-hidden />
            Leave {organisationName}…
          </MenuItem>
        ) : null}
      </MenuContent>
    </Menu>
  );
}

/** "Two-step on" in the meta line; "Two-step off" as a warning, with a mark, not colour alone. */
function TwoStepNote({ text, warning }: { text: string; warning: boolean }) {
  if (!warning) return <>{text}</>;
  return (
    <span className="inline-flex items-center gap-1 font-medium text-lax-warning-fg">
      <TriangleAlert aria-hidden className="size-3.5" strokeWidth={1.75} />
      {text}
    </span>
  );
}

/**
 * One member: initials, name and email, two-step when it matters, the role as text and a "…"
 * menu with what the viewer may do (change the role, view activity, hand over ownership, remove).
 * On a phone the role sits under the name, so nothing runs past the card edge.
 */
export function MemberRow({
  row,
  shownRole,
  error,
  organisationName,
  onChangeRole,
  onTransfer,
  onRemove,
  onLeave,
}: Props) {
  return (
    <RecordRow
      leading={<MemberInitials>{row.initials}</MemberInitials>}
      title={
        <>
          {row.name}
          {row.isYou ? (
            <span className="ml-2 text-lax-12 font-normal text-lax-muted">You</span>
          ) : null}
        </>
      }
      meta={[
        row.email,
        row.twoStep ? <TwoStepNote key="two-step" {...row.twoStep} /> : null,
        row.lastActive,
      ]}
      status={
        <span className="inline-flex items-center text-lax-ui text-lax-fg @2xl:h-lax-control-md @2xl:w-40 @2xl:px-3">
          {shownRole}
        </span>
      }
      menu={
        <MemberMenu
          row={row}
          organisationName={organisationName}
          onChangeRole={onChangeRole}
          onTransfer={onTransfer}
          onRemove={onRemove}
          onLeave={onLeave}
        />
      }
      detail={
        error ? (
          <p role="alert" className="text-lax-12 font-medium text-lax-danger">
            {error}
          </p>
        ) : null
      }
    />
  );
}
